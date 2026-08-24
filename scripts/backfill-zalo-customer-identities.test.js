const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  exportRecentWebhookChats,
  normalizePhone,
  parseArguments,
  runBackfill,
} = require('./backfill-zalo-customer-identities');

test('parses zalo backfill CLI arguments', () => {
  assert.deepEqual(
    parseArguments(['--env-file', '.env.public-production', '--mapping-file', 'zalo-map.json', '--tenant-id', 'tenant-1', '--match-by', 'phone', '--apply']),
    {
      envFile: '.env.public-production',
      mappingFile: 'zalo-map.json',
      tenantId: 'tenant-1',
      matchBy: 'phone',
      apply: true,
      overwrite: false,
      exportRecentWebhookChats: false,
    },
  );
});

test('normalizes phone numbers for exact matching', () => {
  assert.equal(normalizePhone('0901 000 001'), '0901000001');
});

test('exports recent webhook chats from tenant settings', async () => {
  const prisma = {
    appSetting: {
      findMany: async () => [{
        tenantId: 'tenant-1',
        updatedAt: new Date('2026-08-24T01:00:00.000Z'),
        value: {
          recentWebhookChats: [
            { chatId: 'chat-1', userId: 'user-1', displayName: 'Khach A', eventName: 'message', lastSeenAt: '2026-08-24T00:59:00.000Z' },
          ],
        },
      }],
    },
  };

  const rows = await exportRecentWebhookChats(prisma, 'tenant-1');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].chatId, 'chat-1');
  assert.equal(rows[0].tenantId, 'tenant-1');
});

test('backfills customer zalo identities from mapping file in dry-run mode', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'homeland-zalo-backfill-'));
  const mappingFile = path.join(root, 'mapping.json');
  fs.writeFileSync(mappingFile, JSON.stringify([
    { tenantId: 'tenant-1', phone: '0901 000 001', chatId: 'chat-1', userId: 'user-1' },
  ]));

  const prisma = {
    customer: {
      findFirst: async ({ where }) => {
        assert.equal(where.phone, '0901000001');
        return {
          id: 'customer-1',
          tenantId: 'tenant-1',
          fullName: 'Khach A',
          phone: '0901000001',
          email: null,
          zaloChatId: null,
          zaloUserId: null,
        };
      },
      update: async () => {
        throw new Error('update should not be called in dry-run');
      },
    },
  };

  const result = await runBackfill({
    envFile: null,
    mappingFile,
    tenantId: '',
    matchBy: 'phone',
    apply: false,
    overwrite: false,
    exportRecentWebhookChats: false,
  }, { prisma });

  assert.equal(result.updatedCustomers, 1);
  assert.equal(result.updates[0].status, 'DRY_RUN');
  assert.equal(result.updates[0].after.zaloChatId, 'chat-1');
});
