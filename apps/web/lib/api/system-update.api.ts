import { apiClient } from './client';

export type SystemUpdateCheck = {
  currentVersion: string;
  latestVersion: string;
  packageVersion: string;
  updateAvailable: boolean;
  mode: string;
  canInstallAutomatically: boolean;
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
  dryRun?: boolean;
  startedAt?: string;
  finishedAt?: string;
  logs: string[];
};

export const systemUpdateApi = {
  check: () => apiClient.get<SystemUpdateCheck>('/system-update/check'),
  status: () => apiClient.get<SystemUpdateJob>('/system-update/status'),
  install: (payload: { targetVersion?: string; dryRun?: boolean }) =>
    apiClient.post<SystemUpdateJob>('/system-update/install', payload),
  rollback: (payload: { targetVersion?: string; dryRun?: boolean }) =>
    apiClient.post<SystemUpdateJob>('/system-update/rollback', payload),
};
