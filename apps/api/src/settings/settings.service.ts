import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, SettingScope } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../shared/audit/audit.service';

export interface SettingsSectionRecord {
  key: string;
  scope: SettingScope;
  value: Prisma.JsonValue;
  updatedAt: Date;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private resolveOwnerId(scope: SettingScope, tenantId: string, userId: string) {
    return scope === SettingScope.USER ? userId : tenantId;
  }

  async getSection(tenantId: string, userId: string, key: string, scope: SettingScope = SettingScope.TENANT): Promise<SettingsSectionRecord> {
    const ownerId = this.resolveOwnerId(scope, tenantId, userId);
    const record = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope,
          ownerId,
          key,
        },
      },
    });

    return {
      key,
      scope,
      value: record?.value ?? {},
      updatedAt: record?.updatedAt ?? new Date(0),
    };
  }

  async saveSection(
    tenantId: string,
    userId: string,
    key: string,
    scope: SettingScope,
    value: Prisma.InputJsonValue,
    updatedBy?: string,
  ): Promise<SettingsSectionRecord> {
    const ownerId = this.resolveOwnerId(scope, tenantId, userId);
    await this.ensureSecretUpdateAllowed(tenantId, userId, key, value);
    const previous = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope,
          ownerId,
          key,
        },
      },
    });
    const nextValue = mergePreservedSecrets(key, previous?.value, value);
    const transactionResult = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.appSetting.upsert({
        where: {
          tenantId_scope_ownerId_key: {
            tenantId,
            scope,
            ownerId,
            key,
          },
        },
        create: {
          tenantId,
          scope,
          ownerId,
          key,
          value: nextValue,
          updatedBy,
        },
        update: {
          value: nextValue,
          updatedBy,
        },
      });

      const ownerChanges = key === 'owners' && scope === SettingScope.TENANT
        ? await syncOwnerDirectory(tx, tenantId, nextValue)
        : [];

      return { saved, ownerChanges };
    });
    const record = transactionResult.saved;

    await this.audit.log({
      action: 'UPDATE',
      entity: 'AppSetting',
      entityId: record.id,
      module: 'Settings',
      tenantId,
      userId,
      before: sanitizeSettingsAuditValue(key, previous?.value),
      after: sanitizeSettingsAuditValue(key, nextValue),
    });

    for (const change of transactionResult.ownerChanges) {
      await this.audit.log({
        action: 'UPDATE',
        entity: 'Owner',
        entityId: change.after.id,
        module: 'Settings',
        tenantId,
        userId,
        before: change.before,
        after: change.after,
      });
    }

    return {
      key: record.key,
      scope: record.scope,
      value: record.value,
      updatedAt: record.updatedAt,
    };
  }

  private async ensureSecretUpdateAllowed(tenantId: string, userId: string, key: string, value: Prisma.InputJsonValue) {
    if (key !== 'hunonic' || !containsHunonicSecret(value)) return;

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { email: true },
    });
    const email = user?.email?.toLowerCase() ?? '';
    if (email === 'admina@homeland.local' || email === 'adminb@homeland.local') return;

    await this.audit.log({
      action: 'UPDATE',
      entity: 'AppSetting',
      entityId: key,
      module: 'Settings',
      tenantId,
      userId,
      before: { denied: true, reason: 'HUNONIC_SECRET_UPDATE_FORBIDDEN', key },
      after: sanitizeSettingsAuditValue(key, value),
    });

    throw new BadRequestException('Chỉ owner admin A/B được chỉnh sửa token hoặc mật khẩu Hunonic.');
  }
}

async function syncOwnerDirectory(tx: Prisma.TransactionClient, tenantId: string, value: Prisma.InputJsonValue) {
  if (!isRecord(value)) return [];
  const settings = value as unknown as Record<string, unknown>;

  const ownerUpdates = [
    {
      code: 'OWNER-A',
      name: settings.ownerAName,
      email: settings.ownerAContactEmail,
      phone: settings.ownerAPhone,
    },
    {
      code: 'OWNER-B',
      name: settings.ownerBName,
      email: settings.ownerBContactEmail,
      phone: settings.ownerBPhone,
    },
  ];

  const changes = [];
  for (const owner of ownerUpdates) {
    const name = normalizeOptionalText(owner.name);
    if (!name) throw new BadRequestException('OWNER_NAME_REQUIRED');

    const before = await tx.owner.findFirst({
      where: { tenantId, code: owner.code, isActive: true },
      select: { id: true, code: true, name: true, email: true, phone: true },
    });
    if (!before) throw new BadRequestException('OWNER_DIRECTORY_INCOMPLETE');

    const after = await tx.owner.update({
      where: { id: before.id },
      data: {
        name,
        email: normalizeOptionalText(owner.email),
        phone: normalizeOptionalText(owner.phone),
      },
      select: { id: true, code: true, name: true, email: true, phone: true },
    });
    changes.push({ before, after });
  }

  return changes;
}

function normalizeOptionalText(value: unknown) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || null;
}

function mergePreservedSecrets(key: string, previous: Prisma.JsonValue | undefined, next: Prisma.InputJsonValue) {
  if (key !== 'hunonic' || !isRecord(previous) || !isRecord(next)) return next;

  const merged = { ...previous, ...next };
  for (const secretKey of ['password', 'websiteToken', 'websiteCookie']) {
    if (!Object.prototype.hasOwnProperty.call(next, secretKey)) {
      merged[secretKey] = previous[secretKey];
    }
  }
  return merged as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function containsHunonicSecret(value: Prisma.InputJsonValue) {
  if (!isRecord(value)) return false;
  return ['password', 'websiteToken', 'websiteCookie'].some((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function sanitizeSettingsAuditValue(key: string, value: Prisma.JsonValue | Prisma.InputJsonValue | undefined) {
  if (!value || !isRecord(value)) return value ?? null;
  const sanitized = { ...value };
  if (key === 'hunonic') {
    for (const secretKey of ['password', 'websiteToken', 'websiteCookie']) {
      if (Object.prototype.hasOwnProperty.call(sanitized, secretKey)) {
        sanitized[secretKey] = sanitized[secretKey] ? '__redacted__' : '';
      }
    }
  }
  return sanitized;
}
