export type AppRuntimeRole = 'all' | 'api' | 'notification-worker';

const VALID_RUNTIME_ROLES: AppRuntimeRole[] = ['all', 'api', 'notification-worker'];

export function resolveAppRuntimeRole(config: Record<string, unknown> = process.env): AppRuntimeRole {
  const raw = typeof config.APP_RUNTIME_ROLE === 'string' ? config.APP_RUNTIME_ROLE.trim().toLowerCase() : '';
  if (raw === 'api' || raw === 'notification-worker' || raw === 'all') return raw;
  return 'all';
}

export function isValidAppRuntimeRole(value: string) {
  return VALID_RUNTIME_ROLES.includes(value as AppRuntimeRole);
}

export function shouldExposeHttpServer(config: Record<string, unknown> = process.env) {
  return resolveAppRuntimeRole(config) !== 'notification-worker';
}

export function shouldRunGeneralSchedulers(config: Record<string, unknown> = process.env) {
  const role = resolveAppRuntimeRole(config);
  return role === 'all' || role === 'api';
}

export function shouldRunNotificationWorker(config: Record<string, unknown> = process.env) {
  const role = resolveAppRuntimeRole(config);
  return role === 'all' || role === 'notification-worker';
}

export function notificationWorkerHeartbeatPath(config: Record<string, unknown> = process.env) {
  const raw = typeof config.NOTIFICATION_WORKER_HEARTBEAT_PATH === 'string'
    ? config.NOTIFICATION_WORKER_HEARTBEAT_PATH.trim()
    : '';
  return raw || '.codex-runtime/notification-worker-heartbeat.json';
}
