import { Injectable } from '@nestjs/common';
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
    const currentVersion = getCurrentCommit();
    const remoteVersion = getRemoteCommit(this.repositoryUrl);
    const packageVersion = readPackageVersion();
    const mode = process.env.SYSTEM_UPDATE_MODE || 'dry-run';

    return {
      currentVersion,
      latestVersion: remoteVersion || currentVersion,
      packageVersion,
      updateAvailable: Boolean(remoteVersion && currentVersion !== remoteVersion),
      mode,
      canInstallAutomatically: mode === 'enabled',
      repository: this.repositoryUrl,
      checkedAt: new Date().toISOString(),
      changelog: buildChangelog(currentVersion, remoteVersion),
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
    const scriptPath = join(process.cwd(), 'scripts', 'update', job.type === 'rollback' ? 'rollback-version.ps1' : 'install-version.ps1');
    const powershell = process.env.SYSTEM_UPDATE_POWERSHELL_PATH || 'powershell.exe';
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
      process.env.SYSTEM_UPDATE_ROOT || join(process.cwd(), '.codex-update'),
      '-Repository',
      this.repositoryUrl,
    ];

    if (job.type === 'rollback') {
      args.splice(args.indexOf('-Repository'), 2);
    }

    job.logs.push(`${new Date().toISOString()} Starting runner: ${job.type} ${shortSha(job.toVersion)}`);
    const child = spawn(powershell, args, {
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

function buildChangelog(currentVersion: string, remoteVersion: string | null) {
  if (!remoteVersion || currentVersion === remoteVersion) {
    return [
      'Đang chạy version mới nhất theo remote HEAD hoặc không đọc được remote.',
      'Không có thay đổi mới để cài đặt ở thời điểm kiểm tra.',
    ];
  }

  const range = `${shortSha(currentVersion)}..${shortSha(remoteVersion)}`;
  return [
    `Phát hiện version mới ${shortSha(remoteVersion)} so với hiện tại ${shortSha(currentVersion)}.`,
    `Cần review commit range ${range} trên GitHub trước khi bật update thật.`,
    'Quy trình an toàn bắt buộc backup DB/env/source, build, preflight, health check và kế hoạch rollback.',
  ];
}

function shortSha(value: string) {
  return value && value !== 'unknown' ? value.slice(0, 7) : value;
}
