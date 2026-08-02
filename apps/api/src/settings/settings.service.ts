import { Injectable } from '@nestjs/common';
import { Prisma, SettingScope } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export interface SettingsSectionRecord {
  key: string;
  scope: SettingScope;
  value: Prisma.JsonValue;
  updatedAt: Date;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const record = await this.prisma.appSetting.upsert({
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
        value,
        updatedBy,
      },
      update: {
        value,
        updatedBy,
      },
    });

    return {
      key: record.key,
      scope: record.scope,
      value: record.value,
      updatedAt: record.updatedAt,
    };
  }
}
