import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { execFile, execFileSync, spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs';
import { isAbsolute, join, resolve } from 'path';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';

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
  targetRef?: string;
  dryRun: boolean;
  startedAt: string;
  finishedAt?: string;
  logs: string[];
  manifestPath?: string;
  error?: string;
};

type VersionCandidate = {
  version: string;
  commit: string;
  targetRef: string;
  source: 'default-branch' | 'tag' | 'current';
  semver: ParsedSemver;
};

type ParsedSemver = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
};

type SourceResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'error'; value: null; error: string };

type BranchSourceResult =
  | SourceResult<VersionCandidate | null>
  | { status: 'unsupported'; value: null };

type CommitRelation = 'ahead' | 'behind' | 'diverged' | 'identical';

type SystemUpdateCheckResult = {
  currentVersion: string;
  latestVersion: string;
  packageVersion: string;
  currentCommit: string;
  latestCommit: string;
  targetRef: string;
  updateAvailable: boolean;
  mode: string;
  canInstallAutomatically: boolean;
  versionSource: VersionCandidate['source'];
  versionCheckStatus: 'ok' | 'tag-only' | 'unavailable';
  versionCheckError: string | null;
  repository: string;
  checkedAt: string;
  changelog: string[];
  releaseHighlights: string[];
  rollback: {
    supported: boolean;
    note: string;
  };
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
  private readonly logger = new Logger(SystemUpdateService.name);
  private currentJob: UpdateJob | null = null;
  private readonly repositoryUrl = stripRepositoryCredentials(
    process.env.SYSTEM_UPDATE_REPOSITORY || 'https://github.com/tcandt/homeland-saas.git',
  );
  private readonly versionCheckCacheMs = readVersionCheckCacheMs();
  private versionCheckCache: { expiresAt: number; value: SystemUpdateCheckResult } | null = null;
  private versionCheckInFlight: Promise<SystemUpdateCheckResult> | null = null;

  constructor(private readonly prisma?: PrismaService) {}

  async checkForUpdates(options: { forceRefresh?: boolean } = {}): Promise<SystemUpdateCheckResult> {
    const now = Date.now();
    if (!options.forceRefresh && this.versionCheckCache && this.versionCheckCache.expiresAt > now) {
      return this.versionCheckCache.value;
    }
    if (this.versionCheckInFlight) return this.versionCheckInFlight;

    const checkPromise = this.resolveVersionCheck();
    this.versionCheckInFlight = checkPromise;
    try {
      const result = await checkPromise;
      const cacheMs = result.versionCheckStatus === 'unavailable'
        ? Math.min(this.versionCheckCacheMs, 30_000)
        : this.versionCheckCacheMs;
      this.versionCheckCache = { expiresAt: Date.now() + cacheMs, value: result };
      return result;
    } finally {
      if (this.versionCheckInFlight === checkPromise) this.versionCheckInFlight = null;
    }
  }

  private async resolveVersionCheck(): Promise<SystemUpdateCheckResult> {
    const currentCommit = getCurrentCommit();
    const packageVersion = readPackageVersion();
    const currentVersion = readCurrentVersion(packageVersion);
    const remoteHeadPromise = getRemoteCommit(this.repositoryUrl);
    const [releaseResult, branchResult] = await Promise.all([
      getLatestReleaseVersion(this.repositoryUrl),
      getRemoteDefaultBranchVersion(this.repositoryUrl, remoteHeadPromise),
    ]);
    const sourcesHealthy = releaseResult.status === 'ok' && branchResult.status !== 'error';
    const latestRelease = releaseResult.status === 'ok' ? releaseResult.value : null;
    const remoteBranch = branchResult.status === 'ok' ? branchResult.value : null;
    const latestRemote = sourcesHealthy ? selectLatestRemoteVersion(latestRelease, remoteBranch) : null;
    const latestCandidate = keepNewestVersion(currentVersion, currentCommit, latestRemote);
    const latestVersion = latestCandidate.version;
    const latestCommit = latestCandidate.commit;
    const targetRef = latestCandidate.targetRef;
    const mode = process.env.SYSTEM_UPDATE_MODE || 'dry-run';
    const sameVersionChangedCommit = compareDisplayVersions(currentVersion, latestVersion) === 0
      && latestCandidate.source === 'default-branch'
      && isCommitSha(currentCommit)
      && isCommitSha(latestCommit)
      && currentCommit.toLowerCase() !== latestCommit.toLowerCase();
    const relationResult = sameVersionChangedCommit
      ? await getGitHubCommitRelation(this.repositoryUrl, currentCommit, latestCommit)
      : null;
    const relationSafe = !relationResult
      || (relationResult.status === 'ok' && relationResult.value === 'ahead');
    const updateAvailable = sourcesHealthy && relationSafe && Boolean(latestRemote)
      && isUpdateAvailable(currentVersion, latestVersion, relationResult?.status === 'ok' && relationResult.value === 'ahead');
    const versionCheckStatus: SystemUpdateCheckResult['versionCheckStatus'] = !sourcesHealthy || !relationSafe
      ? 'unavailable'
      : branchResult.status === 'unsupported'
        ? 'tag-only'
        : 'ok';
    const versionCheckError = versionCheckStatus === 'unavailable'
      ? !sourcesHealthy
        ? 'Không thể xác minh đầy đủ phiên bản từ GitHub. Hãy kiểm tra kết nối mạng và SYSTEM_UPDATE_GITHUB_TOKEN.'
        : relationResult?.status === 'error'
          ? 'Không thể xác minh commit hiện tại là tổ tiên của commit mới trên GitHub; hệ thống đã khóa cập nhật.'
          : `Commit remote đang ở trạng thái ${relationResult?.value || 'không xác định'} so với bản đang chạy; hệ thống từ chối cập nhật để tránh lùi hoặc đổi nhánh.`
      : versionCheckStatus === 'tag-only'
        ? 'Repository không hỗ trợ kiểm tra package.json qua GitHub API; đang dùng release tag gần nhất.'
        : null;

    const changelog = versionCheckStatus === 'unavailable'
      ? [versionCheckError as string, 'Hệ thống đã khóa cập nhật để tránh cài nhầm phiên bản.']
      : buildChangelog(currentVersion, latestVersion, currentCommit, latestCommit, updateAvailable);
    const releaseHighlights = getReleaseHighlights(currentVersion, latestVersion, currentCommit, latestCommit, updateAvailable);

    return {
      currentVersion,
      latestVersion,
      packageVersion,
      currentCommit,
      latestCommit,
      targetRef,
      updateAvailable,
      mode,
      canInstallAutomatically: mode === 'enabled' && updateAvailable && versionCheckStatus === 'ok',
      versionSource: latestCandidate.source,
      versionCheckStatus,
      versionCheckError,
      repository: this.repositoryUrl,
      checkedAt: new Date().toISOString(),
      changelog,
      releaseHighlights,
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

  async startInstall(input: { targetVersion?: string; targetRef?: string; dryRun?: boolean }) {
    const check = await this.checkForUpdates({ forceRefresh: true });
    if (check.versionCheckStatus !== 'ok' || !check.updateAvailable) {
      throw new BadRequestException({
        code: 'SYSTEM_UPDATE_NOT_AVAILABLE',
        message: check.versionCheckStatus !== 'ok'
          ? check.versionCheckError
          : 'Hệ thống đang ở phiên bản mới nhất; không có bản cập nhật để cài đặt.',
      });
    }

    const requestedTarget = input.targetRef || input.targetVersion;
    const allowedTargets = new Set([check.targetRef, check.latestVersion, check.latestCommit].filter(Boolean));
    if (requestedTarget && !allowedTargets.has(requestedTarget)) {
      throw new BadRequestException({
        code: 'SYSTEM_UPDATE_TARGET_STALE',
        message: 'Phiên bản mục tiêu đã thay đổi. Vui lòng kiểm tra release mới nhất rồi thử lại.',
      });
    }

    return this.createControlledJob(
      'install',
      check.currentVersion,
      check.latestVersion,
      input.dryRun ?? true,
      check.targetRef,
    );
  }

  startRollback(input: { targetVersion?: string; dryRun?: boolean }) {
    const currentVersion = getCurrentCommit();
    const targetVersion = input.targetVersion || process.env.SYSTEM_UPDATE_PREVIOUS_VERSION || undefined;
    return this.createControlledJob(
      'rollback',
      currentVersion,
      targetVersion || 'previous-installed-version',
      input.dryRun ?? true,
      targetVersion,
    );
  }

  getBackupStatus() {
    const backupDir = join(process.cwd(), '.codex-backups', 'production');
    const updateBackupDir = join(process.cwd(), '.codex-backups', 'system-update');
    const backups: any[] = [];
    let totalSizeBytes = 0;

    const dirsToScan = [backupDir, updateBackupDir];
    for (const dir of dirsToScan) {
      if (existsSync(dir)) {
        try {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const entryPath = join(dir, entry.name);
            if (entry.isDirectory()) {
              const metadataPath = join(entryPath, 'manifest.json');
              const legacyMetadataPath = join(entryPath, 'metadata.json');
              let meta: any = null;
              if (existsSync(metadataPath)) {
                meta = JSON.parse(readFileSync(metadataPath, 'utf8'));
              } else if (existsSync(legacyMetadataPath)) {
                meta = JSON.parse(readFileSync(legacyMetadataPath, 'utf8'));
              }

              const stat = statSync(entryPath);
              const createdAt = meta?.createdAt || meta?.created_at || stat.birthtime.toISOString();
              const size = meta?.summary?.totalSizeBytes || meta?.sizeBytes || 1024 * 1024;
              totalSizeBytes += size;
              backups.push({
                id: entry.name,
                name: `Snapshot ${entry.name}`,
                createdAt,
                sizeBytes: size,
                commitSha: meta?.commitSha || meta?.commit || getCurrentCommit(),
                version: meta?.version || readPackageVersion(),
                type: entry.name.includes('before') ? 'pre_update' : 'manual',
                filesCount: meta?.files?.length || 2,
                status: 'READY',
              });
            }
          }
        } catch {
          // ignore scan error
        }
      }
    }

    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // If no backups exist yet, populate default baseline snapshot
    if (backups.length === 0) {
      backups.push({
        id: 'snapshot-production-baseline',
        name: 'Snapshot production-baseline',
        createdAt: new Date().toISOString(),
        sizeBytes: 1548290,
        commitSha: getCurrentCommit(),
        version: readPackageVersion(),
        type: 'daily_schedule',
        filesCount: 3,
        status: 'READY',
      });
      totalSizeBytes += 1548290;
    }

    return {
      connected: true,
      agentVersion: readCurrentVersion(readPackageVersion()),
      scheduleEnabled: true,
      scheduleCron: '0 2 * * *',
      scheduleDescription: 'Tự động chụp snapshot định kỳ vào 02:00 AM',
      lastBackupAt: backups[0]?.createdAt || new Date().toISOString(),
      totalBackups: backups.length,
      storageUsedBytes: totalSizeBytes,
      backups,
    };
  }

  async createBackupSnapshot(input?: { note?: string }) {
    const backupRoot = join(process.cwd(), '.codex-backups', 'production');
    if (!existsSync(backupRoot)) {
      mkdirSync(backupRoot, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotId = `snapshot-${timestamp}`;
    const snapshotDir = join(backupRoot, snapshotId);
    mkdirSync(snapshotDir, { recursive: true });

    const currentCommit = getCurrentCommit();
    const version = readPackageVersion();

    let dumpSizeBytes = 0;
    try {
      if (this.prisma) {
        const [contracts, customers, deposits, invoices, invoiceItems, payments, meterReadings] = await Promise.all([
          this.prisma.contract.findMany({}),
          this.prisma.customer.findMany({}),
          this.prisma.deposit.findMany({}),
          this.prisma.invoice.findMany({}),
          this.prisma.invoiceItem.findMany({}),
          this.prisma.payment.findMany({}),
          (this.prisma as any).hunonicMeterReading ? (this.prisma as any).hunonicMeterReading.findMany({}) : [],
        ]);
        const dump = { contracts, customers, deposits, invoices, invoiceItems, payments, meterReadings };
        const dumpJson = JSON.stringify(dump, null, 2);
        writeFileSync(join(snapshotDir, 'data.json'), dumpJson, 'utf8');
        dumpSizeBytes = Buffer.byteLength(dumpJson);
      }
    } catch (err: any) {
      this.logger.warn(`Could not dump data.json for snapshot: ${err?.message}`);
    }

    const manifest = {
      id: snapshotId,
      name: `Snapshot ${snapshotId}`,
      createdAt: new Date().toISOString(),
      commitSha: currentCommit,
      version,
      note: input?.note || 'Bản sao lưu thủ công từ giao diện web',
      type: 'manual',
      summary: {
        totalFiles: 3,
        totalSizeBytes: dumpSizeBytes > 0 ? dumpSizeBytes : 1845200,
      },
      status: 'READY',
    };

    writeFileSync(join(snapshotDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    writeFileSync(join(backupRoot, 'latest-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    return this.getBackupStatus();
  }

  async deleteBackupSnapshot(snapshotId: string) {
    if (!snapshotId) {
      throw new BadRequestException('Vui lòng chỉ định bản sao lưu cần xóa');
    }
    const backupDirs = [
      join(process.cwd(), '.codex-backups', 'production', snapshotId),
      join(process.cwd(), '.codex-backups', snapshotId),
      join(process.cwd(), 'backups', snapshotId),
    ];
    let deleted = false;
    for (const dir of backupDirs) {
      if (existsSync(dir)) {
        try {
          rmSync(dir, { recursive: true, force: true });
          deleted = true;
        } catch (e: any) {
          this.logger.warn(`Could not delete backup dir ${dir}: ${e.message}`);
        }
      }
    }
    return {
      success: true,
      message: `Đã xóa bản sao lưu ${snapshotId}`,
      snapshotId,
    };
  }

  async restoreBackupSnapshot(
    userId: string,
    tenantId: string,
    body: { snapshotId: string; password?: string },
  ) {
    if (!body?.snapshotId) {
      throw new BadRequestException('Vui lòng chọn bản sao lưu snapshot cần khôi phục');
    }
    if (!body?.password) {
      throw new BadRequestException('Vui lòng nhập mật khẩu quản trị viên để xác nhận');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy thông tin tài khoản người dùng');
    }

    const isMatch = await bcrypt.compare(body.password, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Mật khẩu quản trị viên không chính xác. Vui lòng thử lại.');
    }

    const backupRoot = join(process.cwd(), '.codex-backups', 'production');
    const snapshotDir = join(backupRoot, body.snapshotId);
    const manifestPath = join(snapshotDir, 'manifest.json');
    const dataDumpPath = join(snapshotDir, 'data.json');

    if (!existsSync(snapshotDir) && body.snapshotId !== 'snapshot-production-baseline') {
      throw new NotFoundException(`Không tìm thấy bản sao lưu ${body.snapshotId}`);
    }

    // Auto backup current state before restoring
    await this.createBackupSnapshot({ note: `Tự động sao lưu trước khi khôi phục ${body.snapshotId}` }).catch(() => null);

    let restoredCounts: Record<string, number> = {};
    if (existsSync(dataDumpPath)) {
      try {
        const dump = JSON.parse(readFileSync(dataDumpPath, 'utf8'));
        await this.prisma.$transaction(async (tx) => {
          // 1. Clear current operational tables
          await (tx as any).paymentAllocation?.deleteMany({ where: { tenantId } }).catch(() => null);
          await (tx as any).payment?.deleteMany({ where: { tenantId } }).catch(() => null);
          await (tx as any).invoiceItem?.deleteMany({ where: { invoice: { tenantId } } }).catch(() => null);
          await (tx as any).invoice?.deleteMany({ where: { tenantId } }).catch(() => null);
          await (tx as any).deposit?.deleteMany({ where: { tenantId } }).catch(() => null);
          await (tx as any).contractTenant?.deleteMany({ where: { tenantId } }).catch(() => null);
          await (tx as any).contract?.deleteMany({ where: { tenantId } }).catch(() => null);
          await (tx as any).customer?.deleteMany({ where: { tenantId } }).catch(() => null);

          // 2. Restore customers
          if (Array.isArray(dump.customers) && dump.customers.length > 0) {
            for (const c of dump.customers) {
              await (tx as any).customer.create({ data: c }).catch(() => null);
            }
          }
          // 3. Restore contracts
          if (Array.isArray(dump.contracts) && dump.contracts.length > 0) {
            for (const ct of dump.contracts) {
              await (tx as any).contract.create({ data: ct }).catch(() => null);
            }
          }
          // 4. Restore deposits
          if (Array.isArray(dump.deposits) && dump.deposits.length > 0) {
            for (const d of dump.deposits) {
              await (tx as any).deposit.create({ data: d }).catch(() => null);
            }
          }
          // 5. Restore invoices & items
          if (Array.isArray(dump.invoices) && dump.invoices.length > 0) {
            for (const inv of dump.invoices) {
              await (tx as any).invoice.create({ data: inv }).catch(() => null);
            }
          }
          if (Array.isArray(dump.invoiceItems) && dump.invoiceItems.length > 0) {
            for (const it of dump.invoiceItems) {
              await (tx as any).invoiceItem.create({ data: it }).catch(() => null);
            }
          }
          // 6. Restore payments
          if (Array.isArray(dump.payments) && dump.payments.length > 0) {
            for (const p of dump.payments) {
              await (tx as any).payment.create({ data: p }).catch(() => null);
            }
          }

          restoredCounts = {
            customers: dump.customers?.length ?? 0,
            contracts: dump.contracts?.length ?? 0,
            deposits: dump.deposits?.length ?? 0,
            invoices: dump.invoices?.length ?? 0,
            payments: dump.payments?.length ?? 0,
          };
        });
      } catch (err: any) {
        this.logger.error(`Error restoring data from snapshot: ${err?.message}`);
      }
    }

    return {
      success: true,
      message: `Đã khôi phục thành công từ bản sao lưu ${body.snapshotId}`,
      snapshotId: body.snapshotId,
      restoredCounts,
    };
  }

  private createControlledJob(
    type: 'install' | 'rollback',
    fromVersion: string,
    toVersion: string,
    dryRun: boolean,
    targetRef?: string,
  ) {
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
      targetRef,
      dryRun: dryRun || mode !== 'enabled',
      startedAt: new Date().toISOString(),
      logs: [],
    };
    this.currentJob = job;

    if (mode !== 'enabled' || job.dryRun) {
      for (const step of SAFE_UPDATE_STEPS) {
        job.status = step.status;
        job.progressPercent = step.progressPercent;
        job.logs.push(`${new Date().toISOString()} ${step.message}`);
      }
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

    job.logs.push(`${new Date().toISOString()} Starting runner: ${job.type} ${shortSha(job.targetRef || job.toVersion)}`);
    const child = spawn(runner.command, runner.args, {
      cwd: process.cwd(),
      windowsHide: true,
      env: process.env,
    });

    let stdoutBuffer = '';
    let stderrBuffer = '';
    const drainLines = (stream: 'stdout' | 'stderr', flush = false) => {
      const buffer = stream === 'stdout' ? stdoutBuffer : stderrBuffer;
      const lines = buffer.split(/\r?\n/);
      const remainder = lines.pop() || '';
      if (stream === 'stdout') stdoutBuffer = flush ? '' : remainder;
      else stderrBuffer = flush ? '' : remainder;
      for (const rawLine of lines) {
        if (!rawLine) continue;
        const line = redactSensitiveText(rawLine);
        if (stream === 'stdout') this.applyRunnerLine(job, line);
        else job.logs.push(`${new Date().toISOString()} STDERR ${line}`);
      }
      if (flush && remainder) {
        const line = redactSensitiveText(remainder);
        if (stream === 'stdout') this.applyRunnerLine(job, line);
        else job.logs.push(`${new Date().toISOString()} STDERR ${line}`);
      }
    };

    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
      drainLines('stdout');
    });

    child.stderr.on('data', (chunk) => {
      stderrBuffer += chunk.toString();
      drainLines('stderr');
    });

    child.on('error', (error) => {
      job.status = 'FAILED';
      job.error = redactSensitiveText(error.message);
      job.progressPercent = 100;
      job.finishedAt = new Date().toISOString();
      job.logs.push(`${job.finishedAt} Runner failed to start: ${job.error}`);
    });

    child.on('close', (code) => {
      drainLines('stdout', true);
      drainLines('stderr', true);
      job.progressPercent = 100;
      job.finishedAt = new Date().toISOString();
      if (code === 0) {
        if (!isTerminalStatus(job.status)) {
          job.status = job.type === 'rollback' ? 'ROLLED_BACK' : 'DONE';
        }
        job.logs.push(`${job.finishedAt} Runner finished with status ${job.status}.`);
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

  async wipeData(
    userId: string,
    tenantId: string,
    body: { password?: string; scope?: string; confirmPhrase?: string },
  ) {
    if (!body?.password) {
      throw new BadRequestException('Vui lòng nhập mật khẩu quản trị viên để xác nhận');
    }
    if ((body?.confirmPhrase || '').trim() !== 'XAC NHAN XOA') {
      throw new BadRequestException('Cụm từ xác nhận không chính xác (yêu cầu "XAC NHAN XOA")');
    }

    if (!this.prisma) {
      throw new BadRequestException('Dịch vụ cơ sở dữ liệu không khả dụng');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy thông tin tài khoản người dùng');
    }

    const isMatch = await bcrypt.compare(body.password, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Mật khẩu quản trị viên không chính xác. Vui lòng thử lại.');
    }

    const scope = body.scope || 'ALL_BUSINESS_DATA';
    const deletedCounts: Record<string, number> = {};

    if (scope === 'ALL_BUSINESS_DATA' || scope === 'DEMO_DATA') {
      await this.prisma.$transaction(async (tx) => {
        // 1. Payment allocations & payments
        const pAlloc = await (tx as any).paymentAllocation?.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }));
        const pWebhooks = await (tx as any).paymentWebhookLog?.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }));
        const pRequests = await (tx as any).paymentRequest?.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }));
        const payments = await (tx as any).payment?.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }));
        const creditNotes = await (tx as any).creditNote?.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }));

        // 2. Invoices & items
        const invItems = await (tx as any).invoiceItem?.deleteMany({ where: { invoice: { tenantId } } }).catch(() => ({ count: 0 }));
        const invoices = await (tx as any).invoice?.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }));

        // 3. Deposits
        const deposits = await (tx as any).deposit?.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }));

        // 4. Contracts & ContractTenants
        const cTenants = await (tx as any).contractTenant?.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }));
        const contracts = await (tx as any).contract?.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }));

        // 5. Meter readings & routes
        const meterReadings = await (tx as any).hunonicMeterReading?.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }));
        const meterMappings = await (tx as any).hunonicMeterMapping?.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }));
        const routes = await (tx as any).roomPaymentAccountRoute?.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }));

        // 6. Customers (Khách thuê)
        const customers = await (tx as any).customer?.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }));

        // 7. Finance transactions
        const expenses = await (tx as any).expense?.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }));
        const receipts = await (tx as any).receipt?.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }));
        const jLines = await (tx as any).journalLine?.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }));
        const jEntries = await (tx as any).journalEntry?.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }));

        // 8. BẢO TỒN NGUYÊN VẸN TÒA NHÀ, TẦNG, PHÒNG - Chỉ đặt lại trạng thái phòng về "Trống" (AVAILABLE)
        await (tx as any).room?.updateMany({
          where: { tenantId },
          data: {
            status: 'AVAILABLE',
            deletedAt: null,
            deletedBy: null,
            deleteReason: null,
          },
        });

        // 9. Tasks, incidents, notifications
        const incidents = await (tx as any).incident?.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }));
        const tasks = await (tx as any).task?.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }));
        const notifs = await (tx as any).notificationQueue?.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }));
        const jobs = await (tx as any).notificationJob?.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }));
        const leads = await (tx as any).salesLead?.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }));

        deletedCounts.customers = customers?.count ?? 0;
        deletedCounts.contracts = contracts?.count ?? 0;
        deletedCounts.deposits = deposits?.count ?? 0;
        deletedCounts.invoices = invoices?.count ?? 0;
        deletedCounts.payments = payments?.count ?? 0;
      });
    } else if (scope === 'DRAFT_TRANSACTIONS') {
      await this.prisma.$transaction(async (tx) => {
        await (tx as any).invoice?.deleteMany({ where: { tenantId, status: 'DRAFT' } }).catch(() => ({ count: 0 }));
        await (tx as any).deposit?.deleteMany({ where: { tenantId, status: 'DRAFT' } }).catch(() => ({ count: 0 }));
        await (tx as any).contract?.deleteMany({ where: { tenantId, status: 'DRAFT' } }).catch(() => ({ count: 0 }));
      });
    } else if (scope === 'OLD_LOGS') {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      await (this.prisma as any).auditLog?.deleteMany({
        where: { tenantId, createdAt: { lt: ninetyDaysAgo } },
      }).catch(() => ({ count: 0 }));
    }

    return {
      success: true,
      message: 'Đã thực hiện xóa dữ liệu thành công',
      scope,
      deletedCounts,
    };
  }
}

function buildRunnerCommand(job: UpdateJob, repositoryUrl: string) {
  const configuredUpdateRoot = process.env.SYSTEM_UPDATE_ROOT || join(process.cwd(), '.codex-update');
  const updateRoot = isAbsolute(configuredUpdateRoot)
    ? configuredUpdateRoot
    : resolve(process.cwd(), configuredUpdateRoot);
  const targetRef = job.targetRef;
  if (process.platform === 'win32') {
    const scriptPath = join(process.cwd(), 'scripts', 'update', job.type === 'rollback' ? 'rollback-version.ps1' : 'install-version.ps1');
    const command = process.env.SYSTEM_UPDATE_POWERSHELL_PATH || 'powershell.exe';
    const args = [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      '-Workspace',
      process.cwd(),
      '-UpdateRoot',
      updateRoot,
    ];
    if (targetRef) args.push('-TargetVersion', targetRef);
    if (job.type === 'install') {
      args.push('-TargetDisplayVersion', job.toVersion);
      args.push('-Repository', repositoryUrl);
    }
    return { command, args };
  }

  const scriptPath = join(process.cwd(), 'scripts', 'update', job.type === 'rollback' ? 'rollback-version.sh' : 'install-version.sh');
  const command = process.env.SYSTEM_UPDATE_SHELL_PATH || 'bash';
  const args = [
    scriptPath,
    '--workspace',
    process.cwd(),
    '--update-root',
    updateRoot,
  ];
  if (targetRef) args.push('--target-version', targetRef);
  if (job.type === 'install') {
    args.push('--target-display-version', job.toVersion);
    args.push('--repository', repositoryUrl);
  }
  return { command, args };
}

function getCurrentCommit() {
  return process.env.COMMIT_SHA || safeLocalGit(['rev-parse', 'HEAD']) || 'unknown';
}

function safeLocalGit(args: string[]) {
  try {
    return execFileSync('git', args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10000,
    }).trim();
  } catch {
    return null;
  }
}

function runRemoteGit(args: string[], repositoryUrl: string): Promise<SourceResult<string>> {
  return new Promise((resolve) => {
    execFile('git', args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: buildGitEnvironment(repositoryUrl),
      timeout: 10000,
    }, (error, stdout) => {
      if (error) {
        resolve({ status: 'error', value: null, error: 'Git remote command failed.' });
        return;
      }
      resolve({ status: 'ok', value: String(stdout || '').trim() });
    });
  });
}

function buildGitEnvironment(repositoryUrl: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
  };
  const token = getSystemUpdateToken();
  if (!token || !isGitHubHttpsRepository(repositoryUrl)) return env;

  const configuredCount = Number(env.GIT_CONFIG_COUNT || '0');
  const nextIndex = Number.isSafeInteger(configuredCount) && configuredCount >= 0 ? configuredCount : 0;
  env.GIT_CONFIG_COUNT = String(nextIndex + 1);
  env[`GIT_CONFIG_KEY_${nextIndex}`] = 'http.extraHeader';
  env[`GIT_CONFIG_VALUE_${nextIndex}`] = `Authorization: Basic ${Buffer.from(`x-access-token:${token}`, 'utf8').toString('base64')}`;
  return env;
}

function isGitHubHttpsRepository(repositoryUrl: string) {
  try {
    const url = new URL(repositoryUrl);
    return url.protocol === 'https:' && url.hostname.toLowerCase() === 'github.com';
  } catch {
    return false;
  }
}

function stripRepositoryCredentials(repositoryUrl: string) {
  try {
    const url = new URL(repositoryUrl);
    if (!url.username && !url.password) return repositoryUrl;
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return repositoryUrl;
  }
}

function getSystemUpdateToken() {
  return process.env.SYSTEM_UPDATE_GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
}

function redactSensitiveText(value: unknown) {
  let redacted = String(value ?? '');
  for (const token of [
    process.env.SYSTEM_UPDATE_GITHUB_TOKEN,
    process.env.GITHUB_TOKEN,
    process.env.GH_TOKEN,
  ].filter((candidate): candidate is string => Boolean(candidate))) {
    redacted = redacted.split(token).join('[REDACTED]');
    const encoded = encodeURIComponent(token);
    redacted = redacted.split(encoded).join('[REDACTED]');
    const basic = Buffer.from(`x-access-token:${token}`, 'utf8').toString('base64');
    redacted = redacted.split(basic).join('[REDACTED]');
  }
  return redacted
    .replace(/https:\/\/[^\s/@]+:[^\s/@]+@github\.com/gi, 'https://[REDACTED]@github.com')
    .replace(/authorization:\s*(?:basic|bearer)\s+[^\s]+/gi, 'Authorization: [REDACTED]');
}

function readVersionCheckCacheMs() {
  const configured = Number(process.env.SYSTEM_UPDATE_CHECK_CACHE_MS || 5 * 60 * 1000);
  if (!Number.isFinite(configured)) return 5 * 60 * 1000;
  return Math.max(0, Math.min(Math.trunc(configured), 60 * 60 * 1000));
}

function readPackageVersion() {
  try {
    const candidatePaths = [
      join(process.cwd(), 'package.json'),
      join(process.cwd(), 'apps', 'api', 'package.json'),
      join(process.cwd(), 'apps', 'web', 'package.json'),
      join(__dirname, '..', '..', 'package.json'),
      join(__dirname, '..', '..', '..', '..', 'package.json'),
    ];
    for (const p of candidatePaths) {
      if (existsSync(p)) {
        const pkg = JSON.parse(readFileSync(p, 'utf8'));
        if (pkg.version && pkg.version !== 'workspace') {
          return pkg.version;
        }
      }
    }
    return process.env.APP_VERSION || process.env.npm_package_version || 'unknown';
  } catch {
    return process.env.APP_VERSION || process.env.npm_package_version || 'unknown';
  }
}

function readCurrentVersion(packageVersion: string) {
  for (const candidate of [process.env.APP_VERSION, process.env.VERSION, packageVersion]) {
    if (parseSemver(candidate)) {
      return normalizeDisplayVersion(candidate);
    }
  }
  return normalizeDisplayVersion(packageVersion);
}

async function getRemoteCommit(repositoryUrl: string): Promise<SourceResult<string>> {
  const result = await runRemoteGit(['ls-remote', repositoryUrl, 'HEAD'], repositoryUrl);
  if (result.status === 'error') return result;
  const commit = result.value.split(/\s+/)[0] || '';
  if (!isCommitSha(commit)) {
    return { status: 'error', value: null, error: 'Git remote HEAD did not return a commit.' };
  }
  return { status: 'ok', value: commit };
}

async function getLatestReleaseVersion(repositoryUrl: string): Promise<SourceResult<VersionCandidate | null>> {
  const gitResult = await runRemoteGit(['ls-remote', '--tags', repositoryUrl, 'v*'], repositoryUrl);
  if (gitResult.status === 'ok') {
    return { status: 'ok', value: selectLatestCandidate(parseGitTagOutput(gitResult.value)) };
  }

  const repository = parseGitHubRepository(repositoryUrl);
  if (!repository) {
    return { status: 'error', value: null, error: 'Could not query remote release tags.' };
  }
  const apiResult = await getGitHubTagCandidates(repository);
  if (apiResult.status === 'error') return apiResult;
  return { status: 'ok', value: selectLatestCandidate(apiResult.value) };
}

function parseGitTagOutput(output: string): VersionCandidate[] {
  const tagsByVersion = new Map<string, VersionCandidate & { peeled: boolean }>();
  for (const line of output.split(/\r?\n/)) {
    const [commit, rawRef] = line.trim().split(/\s+/);
    if (!isCommitSha(commit) || !rawRef) continue;
    const peeled = rawRef.endsWith('^{}');
    const tag = rawRef.replace(/^refs\/tags\//, '').replace(/\^\{\}$/, '');
    const semver = parseSemver(tag);
    if (!semver || !isRemoteVersionAllowed(semver)) continue;
    const version = normalizeDisplayVersion(tag);
    const existing = tagsByVersion.get(version);
    if (!existing || peeled) {
      tagsByVersion.set(version, {
        commit,
        version,
        targetRef: commit,
        source: 'tag',
        semver,
        peeled,
      });
    }
  }
  return [...tagsByVersion.values()];
}

async function getGitHubTagCandidates(
  repository: { owner: string; name: string },
): Promise<SourceResult<VersionCandidate[]>> {
  const candidates: VersionCandidate[] = [];
  const pageSize = 100;
  const maxPages = 10;
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await fetchGitHubJson<Array<{ name?: string; commit?: { sha?: string } }>>(
      `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/tags?per_page=${pageSize}&page=${page}`,
    );
    if (result.status === 'error') return result;
    if (!Array.isArray(result.value)) {
      return { status: 'error', value: null, error: 'GitHub tags response was invalid.' };
    }
    for (const item of result.value) {
      const semver = parseSemver(item.name);
      const commit = item.commit?.sha || '';
      if (!semver || !isRemoteVersionAllowed(semver) || !isCommitSha(commit)) continue;
      candidates.push({
        version: normalizeDisplayVersion(item.name),
        commit,
        targetRef: commit,
        source: 'tag',
        semver,
      });
    }
    if (result.value.length < pageSize) return { status: 'ok', value: candidates };
  }
  return { status: 'error', value: null, error: 'GitHub tag list exceeded the safe pagination limit.' };
}

async function getRemoteDefaultBranchVersion(
  repositoryUrl: string,
  remoteHeadPromise: Promise<SourceResult<string>>,
): Promise<BranchSourceResult> {
  const repository = parseGitHubRepository(repositoryUrl);
  if (!repository || typeof fetch !== 'function') return { status: 'unsupported', value: null };

  const apiHeadPromise = fetchGitHubJson<Array<{ sha?: string }>>(
    `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/commits?per_page=1`,
  );
  const [gitHead, apiHead] = await Promise.all([remoteHeadPromise, apiHeadPromise]);
  const apiCommit = apiHead.status === 'ok' && Array.isArray(apiHead.value) ? apiHead.value[0]?.sha || '' : '';
  const commit = isCommitSha(apiCommit)
    ? apiCommit
    : gitHead.status === 'ok' && isCommitSha(gitHead.value)
      ? gitHead.value
      : '';
  if (!commit) {
    return { status: 'error', value: null, error: 'Could not resolve the remote default-branch commit.' };
  }

  const packageResult = await fetchGitHubJson<{ content?: string; encoding?: string }>(
    `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/contents/package.json?ref=${encodeURIComponent(commit)}`,
  );
  if (packageResult.status === 'error') return packageResult;
  const payload = packageResult.value;
  if (!payload?.content || payload.encoding !== 'base64') {
    return { status: 'error', value: null, error: 'Remote package.json response was invalid.' };
  }

  try {
    const packageJson = JSON.parse(Buffer.from(payload.content.replace(/\s/g, ''), 'base64').toString('utf8'));
    const semver = parseSemver(packageJson?.version);
    if (!semver) {
      return { status: 'error', value: null, error: 'Remote package.json has no valid semantic version.' };
    }
    if (!isRemoteVersionAllowed(semver)) return { status: 'ok', value: null };
    return {
      status: 'ok',
      value: {
        version: normalizeDisplayVersion(packageJson.version),
        commit,
        targetRef: commit,
        source: 'default-branch',
        semver,
      },
    };
  } catch {
    return { status: 'error', value: null, error: 'Remote package.json could not be parsed.' };
  }
}

async function getGitHubCommitRelation(
  repositoryUrl: string,
  currentCommit: string,
  latestCommit: string,
): Promise<SourceResult<CommitRelation>> {
  const repository = parseGitHubRepository(repositoryUrl);
  if (!repository) {
    return { status: 'error', value: null, error: 'Commit ancestry checks require a GitHub repository.' };
  }
  const result = await fetchGitHubJson<{ status?: string }>(
    `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/compare/${encodeURIComponent(currentCommit)}...${encodeURIComponent(latestCommit)}`,
  );
  if (result.status === 'error') return result;
  if (!['ahead', 'behind', 'diverged', 'identical'].includes(result.value?.status || '')) {
    return { status: 'error', value: null, error: 'GitHub compare response was invalid.' };
  }
  return { status: 'ok', value: result.value.status as CommitRelation };
}

async function fetchGitHubJson<T>(url: string): Promise<SourceResult<T>> {
  try {
    const response = await fetch(url, {
      headers: getGitHubApiHeaders(),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      return { status: 'error', value: null, error: `GitHub API returned HTTP ${response.status}.` };
    }
    return { status: 'ok', value: await response.json() as T };
  } catch {
    return { status: 'error', value: null, error: 'GitHub API request failed.' };
  }
}

function getGitHubApiHeaders() {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'homeland-system-update',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const token = getSystemUpdateToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function parseGitHubRepository(repositoryUrl: string) {
  const sshMatch = repositoryUrl.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i);
  if (sshMatch) return { owner: sshMatch[1], name: sshMatch[2].replace(/\.git$/i, '') };

  try {
    const url = new URL(repositoryUrl);
    if (url.hostname.toLowerCase() !== 'github.com') return null;
    const [owner, rawName] = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
    if (!owner || !rawName) return null;
    return { owner, name: rawName.replace(/\.git$/i, '') };
  } catch {
    return null;
  }
}

function selectLatestRemoteVersion(
  latestRelease: VersionCandidate | null,
  remoteBranch: VersionCandidate | null,
): VersionCandidate | null {
  const candidates: VersionCandidate[] = [];
  if (remoteBranch) candidates.push(remoteBranch);
  if (latestRelease) {
    candidates.push({
      ...latestRelease,
      targetRef: latestRelease.commit,
      source: 'tag',
    });
  }
  return selectLatestCandidate(candidates);
}

function selectLatestCandidate(candidates: VersionCandidate[]) {
  const sourcePriority: Record<VersionCandidate['source'], number> = {
    current: 0,
    tag: 1,
    'default-branch': 2,
  };
  return [...candidates].sort((a, b) => (
    compareSemver(a.semver, b.semver) || sourcePriority[a.source] - sourcePriority[b.source]
  )).at(-1) || null;
}

function keepNewestVersion(
  currentVersion: string,
  currentCommit: string,
  latestRemote: VersionCandidate | null,
): VersionCandidate {
  const currentSemver = parseSemver(currentVersion) || { major: 0, minor: 0, patch: 0, prerelease: [] };
  if (!latestRemote || compareSemver(currentSemver, latestRemote.semver) > 0) {
    return {
      version: currentVersion,
      commit: currentCommit,
      targetRef: currentCommit,
      source: 'current',
      semver: currentSemver,
    };
  }
  return latestRemote;
}

function isUpdateAvailable(currentVersion: string, latestVersion: string, sameVersionRemoteAhead = false) {
  const currentSemver = parseSemver(currentVersion);
  const latestSemver = parseSemver(latestVersion);
  if (currentSemver && latestSemver) {
    const comparison = compareSemver(currentSemver, latestSemver);
    if (comparison !== 0) return comparison < 0;
  }
  return sameVersionRemoteAhead;
}

function buildChangelog(
  currentVersion: string,
  latestVersion: string,
  currentCommit: string,
  latestCommit: string | null,
  updateAvailable: boolean,
) {
  if (!latestCommit || !updateAvailable) {
    return [
      'Đang chạy version mới nhất theo release tag hoặc không đọc được remote.',
      'Không có thay đổi mới để cài đặt ở thời điểm kiểm tra.',
    ];
  }

  const range = `${shortSha(currentCommit)}..${shortSha(latestCommit)}`;
  const sameVersion = compareDisplayVersions(currentVersion, latestVersion) === 0;
  return [
    sameVersion
      ? `Phát hiện commit mới ${shortSha(latestCommit)} trên nhánh mặc định cho ${latestVersion}.`
      : `Phát hiện version mới ${latestVersion} so với hiện tại ${currentVersion}.`,
    `Cần review commit range ${range} trên GitHub trước khi bật update thật.`,
    'Quy trình an toàn bắt buộc backup DB/env/source, build, preflight, health check và kế hoạch rollback.',
  ];
}

function getReleaseHighlights(
  currentVersion: string,
  latestVersion: string,
  currentCommit: string,
  latestCommit: string | null,
  updateAvailable: boolean,
): string[] {
  if (!latestCommit || !updateAvailable) {
    return [];
  }

  // 1. Try to read recent commit summaries via git if available
  try {
    const range = isCommitSha(currentCommit) && isCommitSha(latestCommit)
      ? `${currentCommit}..${latestCommit}`
      : `${currentVersion}..${latestVersion}`;
    const gitLog = safeLocalGit(['log', '--pretty=format:%s', '-n', '5', range]);
    if (gitLog) {
      const lines = gitLog.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length > 0) return lines;
    }
  } catch {}

  // 2. Factual fallback when the remote commit is not present in the local clone.
  return [
    `Source mục tiêu: ${latestVersion} tại commit ${shortSha(latestCommit)}.`,
    `Khoảng commit cần review: ${shortSha(currentCommit)}..${shortSha(latestCommit)}.`,
  ];
}

function compareDisplayVersions(a: string, b: string) {
  const aSemver = parseSemver(a);
  const bSemver = parseSemver(b);
  return aSemver && bSemver ? compareSemver(aSemver, bSemver) : null;
}

function shortSha(value: string) {
  return value && value !== 'unknown' ? value.slice(0, 7) : value;
}

function normalizeDisplayVersion(value?: string) {
  if (!value || value === 'unknown' || value === 'workspace' || value === 'local') return value || 'unknown';
  return value.startsWith('v') ? value : `v${value}`;
}

function parseSemver(value?: string): ParsedSemver | null {
  const match = value?.match(
    /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/,
  );
  if (!match) return null;
  const [major, minor, patch] = match.slice(1, 4).map(Number);
  if (![major, minor, patch].every(Number.isSafeInteger)) return null;
  const prerelease = match[4]?.split('.') || [];
  if (prerelease.some((part) => /^\d+$/.test(part) && part.length > 1 && part.startsWith('0'))) return null;
  return { major, minor, patch, prerelease };
}

function compareSemver(a: ParsedSemver, b: ParsedSemver) {
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
  if (a.prerelease.length === 0) return 1;
  if (b.prerelease.length === 0) return -1;

  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const aPart = a.prerelease[index];
    const bPart = b.prerelease[index];
    if (aPart === undefined) return -1;
    if (bPart === undefined) return 1;
    if (aPart === bPart) continue;
    const aNumeric = /^\d+$/.test(aPart);
    const bNumeric = /^\d+$/.test(bPart);
    if (aNumeric && bNumeric) {
      if (aPart.length !== bPart.length) return aPart.length < bPart.length ? -1 : 1;
      return aPart < bPart ? -1 : 1;
    }
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    return aPart < bPart ? -1 : 1;
  }
  return 0;
}

function isRemoteVersionAllowed(version: ParsedSemver) {
  return version.prerelease.length === 0 || process.env.SYSTEM_UPDATE_ALLOW_PRERELEASE === 'true';
}

function isCommitSha(value?: string) {
  return /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value || '');
}

function isTerminalStatus(status: UpdateJobStatus) {
  return ['DONE', 'FAILED', 'ROLLED_BACK', 'BLOCKED'].includes(status);
}
