import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SettingScope } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../shared/audit/audit.service';

export interface SettingsSectionRecord {
  key: string;
  scope: SettingScope;
  value: Prisma.JsonValue;
  updatedAt: Date;
}

const PROTECTED_SETTING_FIELDS: Record<string, readonly string[]> = {
  hunonic: ['password', 'websiteToken', 'websiteCookie'],
  sepay: ['webhookApiKey'],
  'zalo-provider': ['accessToken', 'appSecret', 'webhookSecret'],
  'email-provider': ['smtpPassword'],
  'telegram-provider': ['botToken'],
};

const SECRET_ADMIN_EMAILS = new Set([
  'admin@homeland.vn',
]);

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly configService: ConfigService,
  ) {}

  private resolveOwnerId(scope: SettingScope, tenantId: string, userId: string) {
    return scope === SettingScope.USER ? userId : tenantId;
  }

  async getSection(tenantId: string, userId: string, key: string, scope: SettingScope = SettingScope.TENANT): Promise<SettingsSectionRecord> {
    const ownerId = this.resolveOwnerId(scope, tenantId, userId);
    const canRevealSecrets = await this.canRevealProtectedFields(tenantId, userId);
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
      value: omitProtectedFields(key, record?.value ?? {}, canRevealSecrets),
      updatedAt: record?.updatedAt ?? new Date(0),
    };
  }

  async getPublicAccessControl() {
    const defaultValue = {
      registrationEnabled: this.configService.get<boolean>('app.allowRegistration') === true,
      maintenanceEnabled: process.env.MAINTENANCE_MODE === 'true' || process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true',
    };
    const tenant = await this.prisma.tenantOrg.findUnique({ where: { code: 'HOMELAND' }, select: { id: true } });
    if (!tenant) return defaultValue;

    const record = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId: tenant.id,
          scope: SettingScope.TENANT,
          ownerId: tenant.id,
          key: 'access-control',
        },
      },
    });

    const value = record?.value;
    if (!isRecord(value)) return defaultValue;
    const settings = value as Record<string, unknown>;
    return {
      registrationEnabled: typeof settings.registrationEnabled === 'boolean'
        ? settings.registrationEnabled
        : defaultValue.registrationEnabled,
      maintenanceEnabled: typeof settings.maintenanceEnabled === 'boolean'
        ? settings.maintenanceEnabled
        : defaultValue.maintenanceEnabled,
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
    const canRevealSecrets = await this.canRevealProtectedFields(tenantId, userId);

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
      value: omitProtectedFields(key, record.value, canRevealSecrets),
      updatedAt: record.updatedAt,
    };
  }

  private async ensureSecretUpdateAllowed(tenantId: string, userId: string, key: string, value: Prisma.InputJsonValue) {
    const submittedSecretFields = getSubmittedSecretFields(key, value);
    if (submittedSecretFields.length === 0) return;

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { email: true },
    });
    const email = user?.email?.toLowerCase() ?? '';
    if (SECRET_ADMIN_EMAILS.has(email)) return;

    await this.audit.log({
      action: 'UPDATE',
      entity: 'AppSetting',
      entityId: key,
      module: 'Settings',
      tenantId,
      userId,
      before: {
        denied: true,
        reason: 'INTEGRATION_SECRET_UPDATE_FORBIDDEN',
        key,
        fields: submittedSecretFields,
      },
      after: sanitizeSettingsAuditValue(key, value),
    });

    throw new BadRequestException('Chỉ tài khoản admin@homeland.vn được chỉnh sửa token hoặc mật khẩu tích hợp.');
  }

  private async canRevealProtectedFields(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { email: true },
    });
    const email = user?.email?.toLowerCase() ?? '';
    return SECRET_ADMIN_EMAILS.has(email);
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
  const protectedFields = PROTECTED_SETTING_FIELDS[key] || [];
  if (protectedFields.length === 0 || !isRecord(previous) || !isRecord(next)) return next;

  const merged = { ...previous, ...next };
  for (const secretKey of protectedFields) {
    if (!Object.prototype.hasOwnProperty.call(next, secretKey)) {
      merged[secretKey] = previous[secretKey];
    }
  }
  return merged as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getSubmittedSecretFields(key: string, value: Prisma.InputJsonValue) {
  if (!isRecord(value)) return [];
  return (PROTECTED_SETTING_FIELDS[key] || []).filter((field) => Object.prototype.hasOwnProperty.call(value, field));
}

function omitProtectedFields(key: string, value: Prisma.JsonValue, revealProtectedFields = false): Prisma.JsonValue {
  if (!isRecord(value) || revealProtectedFields) return value;
  const protectedFields = PROTECTED_SETTING_FIELDS[key] || [];
  if (protectedFields.length === 0) return value;

  const filtered = { ...value };
  for (const field of protectedFields) {
    filtered[`${field}Configured`] = Boolean(filtered[field]);
    delete filtered[field];
  }
  return filtered as Prisma.JsonValue;
}

function sanitizeSettingsAuditValue(key: string, value: Prisma.JsonValue | Prisma.InputJsonValue | undefined) {
  if (!value || !isRecord(value)) return value ?? null;
  const sanitized = { ...value };
  for (const secretKey of PROTECTED_SETTING_FIELDS[key] || []) {
    if (Object.prototype.hasOwnProperty.call(sanitized, secretKey)) {
      sanitized[secretKey] = sanitized[secretKey] ? '__redacted__' : '';
    }
  }
  return sanitized;
}
