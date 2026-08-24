#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { PrismaClient, SettingScope } = require('@prisma/client');

function parseArguments(argv) {
  const options = {
    envFile: null,
    mappingFile: null,
    tenantId: '',
    matchBy: 'phone',
    apply: false,
    overwrite: false,
    exportRecentWebhookChats: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--env-file') {
      options.envFile = argv[index + 1] || null;
      index += 1;
    } else if (argument === '--mapping-file') {
      options.mappingFile = argv[index + 1] || null;
      index += 1;
    } else if (argument === '--tenant-id') {
      options.tenantId = argv[index + 1] || '';
      index += 1;
    } else if (argument === '--match-by') {
      options.matchBy = (argv[index + 1] || options.matchBy).toLowerCase();
      index += 1;
    } else if (argument === '--apply') {
      options.apply = true;
    } else if (argument === '--overwrite') {
      options.overwrite = true;
    } else if (argument === '--export-recent-webhook-chats') {
      options.exportRecentWebhookChats = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!['customerid', 'phone', 'email'].includes(options.matchBy)) {
    throw new Error('--match-by must be one of customerId, phone, email.');
  }
  if (!options.exportRecentWebhookChats && !options.mappingFile) {
    throw new Error('Provide --mapping-file or use --export-recent-webhook-chats.');
  }

  return options;
}

function loadEnvFile(envFile) {
  if (!envFile) return;
  const resolved = path.resolve(envFile);
  if (!fs.existsSync(resolved)) throw new Error(`Environment file not found: ${resolved}`);
  require('dotenv').config({ path: resolved });
}

function normalizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

function loadMappings(mappingFile) {
  const resolved = path.resolve(mappingFile);
  if (!fs.existsSync(resolved)) throw new Error(`Mapping file not found: ${resolved}`);
  const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error('Mapping file must be a JSON array.');
  return parsed;
}

async function exportRecentWebhookChats(prisma, tenantId = '') {
  const rows = await prisma.appSetting.findMany({
    where: {
      key: 'zalo-provider',
      scope: SettingScope.TENANT,
      ...(tenantId ? { tenantId } : {}),
    },
    select: { tenantId: true, value: true, updatedAt: true },
  });

  const exported = rows.flatMap((row) => {
    const recent = Array.isArray(row.value?.recentWebhookChats) ? row.value.recentWebhookChats : [];
    return recent.map((chat) => ({
      tenantId: row.tenantId,
      chatId: String(chat?.chatId || '').trim() || null,
      userId: String(chat?.userId || '').trim() || null,
      displayName: String(chat?.displayName || '').trim() || null,
      eventName: String(chat?.eventName || '').trim() || null,
      lastSeenAt: String(chat?.lastSeenAt || '').trim() || null,
      sourceUpdatedAt: row.updatedAt.toISOString(),
    }));
  }).filter((row) => row.chatId || row.userId);

  return exported;
}

async function runBackfill(options, deps = {}) {
  loadEnvFile(options.envFile);
  const prisma = deps.prisma || new PrismaClient();
  const disconnect = deps.prisma ? async () => undefined : async () => prisma.$disconnect();

  try {
    if (options.exportRecentWebhookChats) {
      const exported = await exportRecentWebhookChats(prisma, options.tenantId);
      const result = { mode: 'exportRecentWebhookChats', count: exported.length, rows: exported };
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return result;
    }

    const mappings = loadMappings(options.mappingFile);
    const summary = {
      mode: 'backfillCustomers',
      apply: options.apply,
      overwrite: options.overwrite,
      matchBy: options.matchBy,
      totalMappings: mappings.length,
      matchedCustomers: 0,
      updatedCustomers: 0,
      skippedCustomers: 0,
      missingCustomers: [],
      updates: [],
    };

    for (const mapping of mappings) {
      const tenantId = String(mapping.tenantId || options.tenantId || '').trim();
      if (!tenantId) throw new Error('Each mapping requires tenantId unless --tenant-id is provided.');

      const where = { tenantId };
      if (options.matchBy === 'customerid') {
        where.id = String(mapping.customerId || '').trim();
      } else if (options.matchBy === 'phone') {
        where.phone = normalizePhone(mapping.phone);
      } else if (options.matchBy === 'email') {
        where.email = String(mapping.email || '').trim().toLowerCase();
      }

      const customer = await prisma.customer.findFirst({
        where,
        select: {
          id: true,
          tenantId: true,
          fullName: true,
          phone: true,
          email: true,
          zaloChatId: true,
          zaloUserId: true,
        },
      });

      if (!customer) {
        summary.missingCustomers.push({
          tenantId,
          customerId: mapping.customerId || null,
          phone: mapping.phone || null,
          email: mapping.email || null,
        });
        continue;
      }

      summary.matchedCustomers += 1;
      const nextChatId = String(mapping.zaloChatId || mapping.chatId || '').trim() || null;
      const nextUserId = String(mapping.zaloUserId || mapping.userId || '').trim() || null;

      const update = {};
      if (nextChatId && (options.overwrite || !customer.zaloChatId)) update.zaloChatId = nextChatId;
      if (nextUserId && (options.overwrite || !customer.zaloUserId)) update.zaloUserId = nextUserId;

      if (!Object.keys(update).length) {
        summary.skippedCustomers += 1;
        summary.updates.push({
          customerId: customer.id,
          tenantId,
          fullName: customer.fullName,
          status: 'SKIPPED',
          reason: 'No new Zalo identity to write.',
        });
        continue;
      }

      if (options.apply) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: update,
        });
      }

      summary.updatedCustomers += 1;
      summary.updates.push({
        customerId: customer.id,
        tenantId,
        fullName: customer.fullName,
        status: options.apply ? 'UPDATED' : 'DRY_RUN',
        before: {
          zaloChatId: customer.zaloChatId || null,
          zaloUserId: customer.zaloUserId || null,
        },
        after: {
          zaloChatId: update.zaloChatId ?? customer.zaloChatId ?? null,
          zaloUserId: update.zaloUserId ?? customer.zaloUserId ?? null,
        },
      });
    }

    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return summary;
  } finally {
    await disconnect();
  }
}

if (require.main === module) {
  runBackfill(parseArguments(process.argv.slice(2))).catch((error) => {
    process.stderr.write(`Zalo backfill failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  exportRecentWebhookChats,
  normalizePhone,
  parseArguments,
  runBackfill,
};
