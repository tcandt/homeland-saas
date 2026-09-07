import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SettingScope } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';
import { ZaloProvider } from '../providers/communication.providers';
import { shouldRunGeneralSchedulers } from '../../shared/config/runtime-mode';
import { SystemUpdateService } from '../../system-update/system-update.service';
import { RequestAnomalySnapshot, RequestAnomalyTrackerService } from '../../metrics/request-anomaly-tracker.service';
import {
  buildServerOverloadAlertMessage,
  buildUpdateAvailableMessage,
  buildUpdateSuccessMessage,
} from './admin-zalo-message-builder';

type TenantZaloConfig = {
  settingId: string;
  tenantId: string;
  adminGroupChatId: string;
  value: Record<string, any>;
};

@Injectable()
export class AdminZaloAlertsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminZaloAlertsService.name);
  private readonly updateCooldownMs = Number(process.env.ADMIN_ZALO_UPDATE_ALERT_COOLDOWN_MS || 12 * 60 * 60 * 1000);
  private readonly overloadCooldownMs = Number(process.env.ADMIN_ZALO_OVERLOAD_ALERT_COOLDOWN_MS || 15 * 60 * 1000);
  private readonly overloadThresholdRequests = Number(process.env.ADMIN_ZALO_OVERLOAD_THRESHOLD_REQUESTS || 600);
  private readonly overloadThresholdRps = Number(process.env.ADMIN_ZALO_OVERLOAD_THRESHOLD_RPS || 10);
  private readonly overloadThresholdUniqueIps = Number(process.env.ADMIN_ZALO_OVERLOAD_THRESHOLD_UNIQUE_IPS || 25);
  private readonly overloadThresholdTopIpRequests = Number(process.env.ADMIN_ZALO_OVERLOAD_THRESHOLD_TOP_IP_REQUESTS || 120);

  constructor(
    private readonly prisma: PrismaService,
    private readonly zaloProvider: ZaloProvider,
    private readonly systemUpdateService: SystemUpdateService,
    private readonly requestAnomalyTracker: RequestAnomalyTrackerService,
  ) {}

  onApplicationBootstrap() {
    if (!shouldRunGeneralSchedulers()) return;
    void this.checkVersionUpgradeAndNotify().catch((err: any) => {
      this.logger.warn(`Failed to check version upgrade notification on startup: ${err?.message || err}`);
    });
  }

  async checkVersionUpgradeAndNotify() {
    const check = await this.systemUpdateService.checkForUpdates();
    const currentVersion = check.currentVersion;
    const currentArtifact = artifactIdentity(currentVersion, check.currentCommit);

    const tenants = await this.getTenantsWithAdminGroup();
    for (const tenant of tenants) {
      const state = readAlertState(tenant.value);
      const lastRecordedVersion = state.lastRecordedActiveVersion;
      const lastRecordedArtifact = state.lastRecordedActiveArtifact;

      if (!lastRecordedVersion && !lastRecordedArtifact) {
        await this.updateAlertState(tenant, {
          lastRecordedActiveVersion: currentVersion,
          lastRecordedActiveArtifact: currentArtifact,
        });
        continue;
      }

      // Migrate legacy state without claiming a same-version deploy happened.
      if (!lastRecordedArtifact && lastRecordedVersion === currentVersion) {
        await this.updateAlertState(tenant, { lastRecordedActiveArtifact: currentArtifact });
        continue;
      }

      if (lastRecordedArtifact !== currentArtifact) {
        const built = buildUpdateSuccessMessage({
          fromVersion: lastRecordedVersion,
          toVersion: currentVersion,
          updatedAt: new Date(),
          note: 'Hệ thống đã cập nhật và khởi động thành công trên phiên bản mới.',
        });

        try {
          await this.zaloProvider.send({
            tenantId: tenant.tenantId,
            recipient: tenant.adminGroupChatId,
            title: built.title,
            message: built.message,
            context: {},
          });
        } catch (err: any) {
          this.logger.warn(`Failed to send update success alert to tenant ${tenant.tenantId}: ${err?.message || err}`);
        }

        await this.updateAlertState(tenant, {
          lastRecordedActiveVersion: currentVersion,
          lastRecordedActiveArtifact: currentArtifact,
          lastUpdateSuccessAlertAt: new Date().toISOString(),
        });
      }
    }
  }

  async notifyManualUpdateSuccess(input: {
    fromVersion?: string | null;
    toVersion: string;
    durationSeconds?: number | null;
    note?: string | null;
  }) {
    const tenants = await this.getTenantsWithAdminGroup();
    const built = buildUpdateSuccessMessage({
      fromVersion: input.fromVersion,
      toVersion: input.toVersion,
      updatedAt: new Date(),
      durationSeconds: input.durationSeconds,
      note: input.note,
    });

    for (const tenant of tenants) {
      try {
        await this.zaloProvider.send({
          tenantId: tenant.tenantId,
          recipient: tenant.adminGroupChatId,
          title: built.title,
          message: built.message,
          context: {},
        });
      } catch (err: any) {
        this.logger.warn(`Failed to send manual update success alert to tenant ${tenant.tenantId}: ${err?.message || err}`);
      }
    }
  }

  @Cron('0 10 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async checkUpdateAvailableAlerts() {
    if (!shouldRunGeneralSchedulers()) return;

    const check = await this.systemUpdateService.checkForUpdates();
    if (!check.updateAvailable) return;
    const latestArtifact = artifactIdentity(check.latestVersion, check.latestCommit);

    const tenants = await this.getTenantsWithAdminGroup();
    for (const tenant of tenants) {
      const state = readAlertState(tenant.value);
      const alreadySentForArtifact = state.lastUpdateAlertArtifact === latestArtifact;
      const cooldownActive =
        state.lastUpdateAlertAt &&
        Date.now() - new Date(state.lastUpdateAlertAt).getTime() < this.updateCooldownMs;

      if (alreadySentForArtifact && cooldownActive) {
        continue;
      }

      const built = buildUpdateAvailableMessage({
        currentVersion: check.currentVersion,
        latestVersion: check.latestVersion,
        checkedAt: check.checkedAt,
        details: check.releaseHighlights.length > 0 ? check.releaseHighlights : check.changelog,
      });

      try {
        await this.zaloProvider.send({
          tenantId: tenant.tenantId,
          recipient: tenant.adminGroupChatId,
          title: built.title,
          message: built.message,
          context: {},
        });
      } catch (err: any) {
        this.logger.warn(`Failed to send update available alert to tenant ${tenant.tenantId}: ${err?.message || err}`);
      }

      await this.updateAlertState(tenant, {
        lastUpdateAlertAt: new Date().toISOString(),
        lastUpdateAlertVersion: check.latestVersion,
        lastUpdateAlertArtifact: latestArtifact,
      });
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkServerOverloadAlerts() {
    if (!shouldRunGeneralSchedulers()) return;

    const snapshot = this.requestAnomalyTracker.getSnapshot();
    if (!this.isOverload(snapshot)) {
      return;
    }

    const tenants = await this.getTenantsWithAdminGroup();
    for (const tenant of tenants) {
      const state = readAlertState(tenant.value);
      const cooldownActive =
        state.lastOverloadAlertAt &&
        Date.now() - new Date(state.lastOverloadAlertAt).getTime() < this.overloadCooldownMs;
      const sameSignature = state.lastOverloadAlertSignature === overloadSignature(snapshot);

      if (cooldownActive && sameSignature) {
        continue;
      }

      const built = buildServerOverloadAlertMessage({
        currentRps: snapshot.requestsPerSecond,
        suspiciousIpCount: snapshot.uniqueIps,
        topSource: snapshot.topSource ? `${snapshot.topSource} (${snapshot.topSourceRequests})` : null,
        detectedAt: new Date(),
      });

      await this.zaloProvider.send({
        tenantId: tenant.tenantId,
        recipient: tenant.adminGroupChatId,
        title: built.title,
        message: built.message,
        context: {},
      });

      await this.updateAlertState(tenant, {
        lastOverloadAlertAt: new Date().toISOString(),
        lastOverloadAlertSignature: overloadSignature(snapshot),
      });
    }
  }

  private isOverload(snapshot: RequestAnomalySnapshot) {
    return (
      snapshot.totalRequests >= this.overloadThresholdRequests ||
      snapshot.requestsPerSecond >= this.overloadThresholdRps ||
      snapshot.uniqueIps >= this.overloadThresholdUniqueIps ||
      snapshot.topSourceRequests >= this.overloadThresholdTopIpRequests
    );
  }

  private async getTenantsWithAdminGroup(): Promise<TenantZaloConfig[]> {
    const rows = await this.prisma.appSetting.findMany({
      where: {
        key: 'zalo-provider',
        scope: SettingScope.TENANT,
      },
      select: {
        id: true,
        tenantId: true,
        value: true,
      },
    });

    return rows
      .map((row) => {
        const value = ((row.value as any) || {}) as Record<string, any>;
        const adminGroupChatId = String(value.adminGroupChatId || '').trim();
        if (!adminGroupChatId) return null;
        return {
          settingId: row.id,
          tenantId: row.tenantId,
          adminGroupChatId,
          value,
        };
      })
      .filter(Boolean) as TenantZaloConfig[];
  }

  private async updateAlertState(tenant: TenantZaloConfig, patch: Record<string, any>) {
    await this.prisma.appSetting.update({
      where: { id: tenant.settingId },
      data: {
        value: {
          ...tenant.value,
          systemAlertState: {
            ...readAlertState(tenant.value),
            ...patch,
          },
        },
      },
    });
    tenant.value = {
      ...tenant.value,
      systemAlertState: {
        ...readAlertState(tenant.value),
        ...patch,
      },
    };
  }
}

function readAlertState(value: Record<string, any>) {
  return (value?.systemAlertState && typeof value.systemAlertState === 'object')
    ? value.systemAlertState
    : {};
}

function overloadSignature(snapshot: RequestAnomalySnapshot) {
  return [snapshot.totalRequests, snapshot.uniqueIps, snapshot.topSource || 'none', snapshot.topSourceRequests].join(':');
}

function artifactIdentity(version: string, commit?: string | null) {
  return `${version}@${commit || 'unknown'}`.toLowerCase();
}
