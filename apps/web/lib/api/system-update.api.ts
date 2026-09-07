import { apiClient } from './client';

export type SystemUpdateCheck = {
  currentVersion: string;
  latestVersion: string;
  packageVersion: string;
  currentCommit: string;
  latestCommit: string;
  targetRef: string;
  updateAvailable: boolean;
  mode: string;
  canInstallAutomatically: boolean;
  versionSource: 'default-branch' | 'tag' | 'current';
  versionCheckStatus: 'ok' | 'tag-only' | 'unavailable';
  versionCheckError: string | null;
  repository: string;
  checkedAt: string;
  changelog: string[];
  rollback: {
    supported: boolean;
    note: string;
  };
};

export type SystemUpdateJob = {
  id: string | null;
  type?: 'install' | 'rollback';
  status: string;
  progressPercent: number;
  fromVersion?: string;
  toVersion?: string;
  targetRef?: string;
  dryRun?: boolean;
  startedAt?: string;
  finishedAt?: string;
  logs: string[];
  manifestPath?: string;
  error?: string;
};

export type BackupManifestInfo = {
  id: string;
  name: string;
  createdAt: string;
  sizeBytes: number;
  commitSha?: string;
  version?: string;
  type: 'manual' | 'daily_schedule' | 'pre_update';
  filesCount: number;
  status: 'READY' | 'CORRUPTED';
};

export type SystemBackupStatus = {
  connected: boolean;
  agentVersion: string;
  scheduleEnabled: boolean;
  scheduleCron: string;
  scheduleDescription: string;
  lastBackupAt: string | null;
  totalBackups: number;
  storageUsedBytes: number;
  backups: BackupManifestInfo[];
};

export const systemUpdateApi = {
  check: (forceRefresh = false) => apiClient.get<SystemUpdateCheck>(
    forceRefresh ? '/system-update/check?refresh=true' : '/system-update/check',
  ),
  status: () => apiClient.get<SystemUpdateJob>('/system-update/status'),
  install: (payload: { targetVersion?: string; targetRef?: string; dryRun?: boolean }) =>
    apiClient.post<SystemUpdateJob>('/system-update/install', payload),
  rollback: (payload: { targetVersion?: string; dryRun?: boolean }) =>
    apiClient.post<SystemUpdateJob>('/system-update/rollback', payload),
  wipeData: (payload: { password: string; scope: string; confirmPhrase: string }) =>
    apiClient.post<{ success: boolean; message: string; scope: string; deletedCounts: Record<string, number> }>(
      '/system-update/wipe-data',
      payload,
    ),
  backups: () => apiClient.get<SystemBackupStatus>('/system-update/backups'),
  createBackup: (payload?: { note?: string }) =>
    apiClient.post<SystemBackupStatus>('/system-update/backups/create', payload || {}),
  restoreBackup: (payload: { snapshotId: string; password: string }) =>
    apiClient.post<{ success: boolean; message: string; snapshotId: string; restoredCounts?: Record<string, number> }>(
      '/system-update/backups/restore',
      payload,
    ),
  deleteBackup: (snapshotId: string) =>
    apiClient.delete<{ success: boolean; message: string; snapshotId: string }>(`/system-update/backups/${snapshotId}`),
};
