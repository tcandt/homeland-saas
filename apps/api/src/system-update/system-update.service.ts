import { ConflictException, Injectable } from '@nestjs/common';
import { execFileSync, spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

type UpdateJobStatus =
  | 'IDLE'
  | 'CHECKING'
  | 'DOWNLOADING'
  | 'BACKING_UP'
  | 'BUILDING'
  | 'MIGRATING'
  | 'SWITCHING'
  | 'RESTARTING'
  | 'HEALTH_CHECK'
  | 'DONE'
  | 'FAILED'
  | 'ROLLED_BACK'
  | 'BLOCKED';

type UpdateJob = {
  id: string;
  type: 'install' | 'rollback';
  status: UpdateJobStatus;
  progressPercent: number;
  fromVersion: string;
  toVersion: string;
  dryRun: boolean;
  startedAt: string;
  finishedAt?: string;
  logs: string[];
  manifestPath?: string;
  error?: string;
};

const SAFE_UPDATE_STEPS: Array<{ status: UpdateJobStatus; progressPercent: number; message: string }> = [
  { status: 'CHECKING', progressPercent: 8, message: 'Đang xác nhận version mục tiêu.' },
  { status: 'DOWNLOADING', progressPercent: 22, message: 'Đã mô phỏng bước tải source/artifact.' },
  { status: 'BACKING_UP', progressPercent: 38, message: 'Đã mô phỏng bước tạo backup trước cập nhật.' },
  { status: 'BUILDING', progressPercent: 56, message: 'Đã mô phỏng bước build và kiểm tra dependency.' },
  { status: 'MIGRATING', progressPercent: 68, message: 'Đã mô phỏng bước kiểm tra migration an toàn.' },
  { status: 'SWITCHING', progressPercent: 78, message: 'Đã mô phỏng bước chuyển active version.' },
  { status: 'RESTARTING', progressPercent: 88, message: 'Đã mô phỏng bước restart service.' },
  { status: 'HEALTH_CHECK', progressPercent: 96, message: 'Đã mô phỏng bước health check sau restart.' },
];

@Injectable()
export class SystemUpdateService {
  private currentJob: UpdateJob | null = null;
  private readonly repositoryUrl = process.env.SYSTEM_UPDATE_REPOSITORY || 'https://github.com/tcandt/homeland-saas.git';

  checkForUpdates() {
    const currentCommit = getCurrentCommit();
    const remoteCommit = getRemoteCommit(this.repositoryUrl);
    const packageVersion = readPackageVersion();
    const currentVersion = readCurrentVersion(packageVersion);
    const latestRelease = getLatestReleaseVersion(this.repositoryUrl);
    const latestVersion = latestRelease?.version || remoteCommit || currentVersion;
    const mode = process.env.SYSTEM_UPDATE_MODE || 'dry-run';
    const updateAvailable = isUpdateAvailable(currentVersion, latestVersion, currentCommit, latestRelease?.commit || remoteCommit);

    return {
      currentVersion,
      latestVersion,
      packageVersion,
      currentCommit,
      latestCommit: latestRelease?.commit || remoteCommit || currentCommit,
      updateAvailable,
      mode,
      canInstallAutomatically: mode === 'enabled',
      repository: this.repositoryUrl,
      checkedAt: new Date().toISOString(),
      changelog: buildChangelog(currentVersion, latestVersion, currentCommit, latestRelease?.commit || remoteCommit),
      rollback: {
        supported: true,
        note: 'Rollback code cần version trước và backup DB tương ứng nếu migration đã chạy.',
      },
    };
  }

  getStatus() {
    return this.currentJob || {
      id: null,
      status: 'IDLE',
      progressPercent: 0,
      logs: [],
    };
  }

  startInstall(input: { targetVersion?: string; dryRun?: boolean }) {
    const check = this.checkForUpdates();
    const targetVersion = input.targetVersion || check.latestVersion;
    return this.createControlledJob('install', check.currentVersion, targetVersion, input.dryRun ?? true);
  }

  startRollback(input: { targetVersion?: string; dryRun?: boolean }) {
    const currentVersion = getCurrentCommit();
    const targetVersion = input.targetVersion || process.env.SYSTEM_UPDATE_PREVIOUS_VERSION || 'previous-version-required';
    return this.createControlledJob('rollback', currentVersion, targetVersion, input.dryRun ?? true);
  }

  private createControlledJob(type: 'install' | 'rollback', fromVersion: string, toVersion: string, dryRun: boolean) {
    if (this.currentJob && !isTerminalStatus(this.currentJob.status)) {
      throw new ConflictException({
        code: 'SYSTEM_UPDATE_JOB_RUNNING',
        message: 'Một job cập nhật hoặc rollback đang chạy. Vui lòng chờ job hiện tại kết thúc.',
        jobId: this.currentJob.id,
        status: this.currentJob.status,
      });
    }

    const mode = process.env.SYSTEM_UPDATE_MODE || 'dry-run';
    const job: UpdateJob = {
      id: `upd_${Date.now()}`,
      type,
      status: 'CHECKING',
      progressPercent: 0,
      fromVersion,
      toVersion,
      dryRun: dryRun || mode !== 'enabled',
      startedAt: new Date().toISOString(),
      logs: [],
    };
    this.currentJob = job;

    for (const step of SAFE_UPDATE_STEPS) {
      job.status = step.status;
      job.progressPercent = step.progressPercent;
      job.logs.push(`${new Date().toISOString()} ${step.message}`);
    }

    if (mode !== 'enabled' || job.dryRun) {
      job.status = 'BLOCKED';
      job.progressPercent = 100;
      job.finishedAt = new Date().toISOString();
      job.logs.push(`${job.finishedAt} SYSTEM_UPDATE_MODE=${mode}; dryRun=${job.dryRun}; chưa chạy runner thật.`);
      return job;
    }

    this.runSystemUpdateScript(job);
    return job;
  }

  private runSystemUpdateScript(job: UpdateJob) {
    const runner = buildRunnerCommand(job, this.repositoryUrl);

    job.logs.push(`${new Date().toISOString()} Starting runner: ${job.type} ${shortSha(job.toVersion)}`);
    const child = spawn(runner.command, runner.args, {
      cwd: process.cwd(),
      windowsHide: true,
      env: process.env,
    });

    child.stdout.on('data', (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) {
        this.applyRunnerLine(job, line);
      }
    });

    child.stderr.on('data', (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) {
        job.logs.push(`${new Date().toISOString()} STDERR ${line}`);
      }
    });

    child.on('error', (error) => {
      job.status = 'FAILED';
      job.error = error.message;
      job.progressPercent = 100;
      job.finishedAt = new Date().toISOString();
      job.logs.push(`${job.finishedAt} Runner failed to start: ${error.message}`);
    });

    child.on('close', (code) => {
      if (job.status === 'FAILED') return;
      job.progressPercent = 100;
      job.finishedAt = new Date().toISOString();
      if (code === 0) {
        job.status = job.type === 'rollback' ? 'ROLLED_BACK' : 'DONE';
        job.logs.push(`${job.finishedAt} Runner finished successfully.`);
      } else {
        job.status = 'FAILED';
        job.error = `Runner exited with code ${code}`;
        job.logs.push(`${job.finishedAt} Runner exited with code ${code}.`);
      }
    });
  }

  private applyRunnerLine(job: UpdateJob, line: string) {
    const stepMatch = line.match(/^SYSTEM_UPDATE_STEP\s+(\S+)\s+(\d+)\s+(.+)$/);
    if (stepMatch) {
      job.status = stepMatch[1] as UpdateJobStatus;
      job.progressPercent = Number(stepMatch[2]);
      job.logs.push(`${new Date().toISOString()} ${stepMatch[3]}`);
      return;
    }

    const manifestMatch = line.match(/^SYSTEM_UPDATE_MANIFEST\s+(.+)$/);
    if (manifestMatch) {
      job.manifestPath = manifestMatch[1];
      job.logs.push(`${new Date().toISOString()} Manifest: ${manifestMatch[1]}`);
      return;
    }

    job.logs.push(`${new Date().toISOString()} ${line}`);
  }
}

function buildRunnerCommand(job: UpdateJob, repositoryUrl: string) {
  const updateRoot = process.env.SYSTEM_UPDATE_ROOT || join(process.cwd(), '.codex-update');
  if (process.platform === 'win32') {
    const scriptPath = join(process.cwd(), 'scripts', 'update', job.type === 'rollback' ? 'rollback-version.ps1' : 'install-version.ps1');
    const command = process.env.SYSTEM_UPDATE_POWERSHELL_PATH || 'powershell.exe';
    const args = [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      '-TargetVersion',
      job.toVersion,
      '-Workspace',
      process.cwd(),
      '-UpdateRoot',
      updateRoot,
    ];
    if (job.type === 'install') {
      args.push('-Repository', repositoryUrl);
    }
    return { command, args };
  }

  const scriptPath = join(process.cwd(), 'scripts', 'update', job.type === 'rollback' ? 'rollback-version.sh' : 'install-version.sh');
  const command = process.env.SYSTEM_UPDATE_SHELL_PATH || 'bash';
  const args = [
    scriptPath,
    '--target-version',
    job.toVersion,
    '--workspace',
    process.cwd(),
    '--update-root',
    updateRoot,
  ];
  if (job.type === 'install') {
    args.push('--repository', repositoryUrl);
  }
  return { command, args };
}

function getCurrentCommit() {
  return process.env.COMMIT_SHA || safeGit(['rev-parse', 'HEAD']) || 'unknown';
}

function getRemoteCommit(repositoryUrl: string) {
  const output = safeGit(['ls-remote', repositoryUrl, 'HEAD']);
  return output?.split(/\s+/)[0] || null;
}

function safeGit(args: string[]) {
  try {
    return execFileSync('git', args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 8000,
    }).trim();
  } catch {
    return null;
  }
}

function readPackageVersion() {
  try {
    const packagePath = join(process.cwd(), 'package.json');
    if (!existsSync(packagePath)) return 'unknown';
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
    return pkg.version || 'workspace';
  } catch {
    return 'unknown';
  }
}

function readCurrentVersion(packageVersion: string) {
  return normalizeDisplayVersion(process.env.APP_VERSION || process.env.VERSION || packageVersion);
}

function getLatestReleaseVersion(repositoryUrl: string) {
  const output = safeGit(['ls-remote', '--tags', '--refs', repositoryUrl, 'v*']);
  if (!output) return null;

  const tags = output
    .split(/\r?\n/)
    .map((line) => {
      const [commit, ref] = line.trim().split(/\s+/);
      const tag = ref?.replace(/^refs\/tags\//, '');
      const semver = parseSemver(tag);
      return commit && tag && semver ? { commit, version: normalizeDisplayVersion(tag), semver } : null;
    })
    .filter((item): item is { commit: string; version: string; semver: [number, number, number] } => Boolean(item))
    .sort((a, b) => compareSemver(a.semver, b.semver));

  return tags.at(-1) || null;
}

function isUpdateAvailable(currentVersion: string, latestVersion: string, currentCommit: string, latestCommit?: string | null) {
  const currentSemver = parseSemver(currentVersion);
  const latestSemver = parseSemver(latestVersion);
  if (currentSemver && latestSemver) return compareSemver(currentSemver, latestSemver) < 0;
  return Boolean(latestCommit && currentCommit !== latestCommit);
}

function buildChangelog(currentVersion: string, latestVersion: string, currentCommit: string, latestCommit: string | null) {
  if (!latestCommit || !isUpdateAvailable(currentVersion, latestVersion, currentCommit, latestCommit)) {
    return [
      'Đang chạy version mới nhất theo release tag hoặc không đọc được remote.',
      'Không có thay đổi mới để cài đặt ở thời điểm kiểm tra.',
    ];
  }

  const range = `${shortSha(currentCommit)}..${shortSha(latestCommit)}`;
  return [
    `Phát hiện version mới ${latestVersion} so với hiện tại ${currentVersion}.`,
    `Cần review commit range ${range} trên GitHub trước khi bật update thật.`,
    'Quy trình an toàn bắt buộc backup DB/env/source, build, preflight, health check và kế hoạch rollback.',
  ];
}

function shortSha(value: string) {
  return value && value !== 'unknown' ? value.slice(0, 7) : value;
}

function normalizeDisplayVersion(value?: string) {
  if (!value || value === 'unknown' || value === 'workspace' || value === 'local') return value || 'unknown';
  return value.startsWith('v') ? value : `v${value}`;
}

function parseSemver(value?: string): [number, number, number] | null {
  const match = value?.match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compareSemver(a: [number, number, number], b: [number, number, number]) {
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function isTerminalStatus(status: UpdateJobStatus) {
  return ['DONE', 'FAILED', 'ROLLED_BACK', 'BLOCKED'].includes(status);
}
