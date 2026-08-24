const fs = require('fs');
const path = require('path');

const TARGETS = [
  '.codex-runtime',
  '.codex-tmp',
  '.tmp-production-verify',
  '.tmp-hunonic-index-7457d0e2',
  '.tmp-hunonic-index-7457d0e2.zip',
  '.tmp-release-index-41286d6.tar',
  '.tmp-release-index-64a06fe1',
  '.tmp-release-index-64a06fe1.zip',
  '.tmp-release-index-6dc7e6da',
  '.tmp-release-index-6dc7e6da.zip',
  '.tmp-release-index-911e2506',
  '.tmp-release-index-911e2506.zip',
  '.tmp-release-index-e8682a08',
  '.tmp-release-index-e8682a08.zip',
  '.tmp-release-index-f48876db',
  '.npm-cache',
  'apps/api/dist',
  'apps/web/.next',
  'apps/web/playwright-report',
  'apps/web/test-results',
  'deploy/public-production/release',
  'api-current.stdout.log',
  'api-current.stderr.log',
  'api-dev.stdout.log',
  'api-dev.stderr.log',
  'api-dev-*.log',
  'dev-*.log',
  'dev-current.stdout.log',
  'dev-current.stderr.log',
  'dev-20260813-114045.stdout.log',
  'dev-20260813-114045.stderr.log',
  'dev-hunonic-20260809-090250.stdout.log',
  'dev-hunonic-20260809-090250.stderr.log',
];

function parseArguments(argv) {
  return {
    apply: argv.includes('--apply'),
    json: argv.includes('--json'),
  };
}

function statSizeBytes(targetPath) {
  if (!fs.existsSync(targetPath)) return 0;
  const stat = fs.lstatSync(targetPath);
  if (stat.isDirectory()) {
    let total = 0;
    for (const entry of fs.readdirSync(targetPath)) {
      total += statSizeBytes(path.join(targetPath, entry));
    }
    return total;
  }
  return stat.size;
}

function removeTarget(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  try {
    fs.rmSync(targetPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch (error) {
    if (!fs.existsSync(targetPath)) return;
    throw error;
  }
}

function expandTarget(cwd, relativeTarget) {
  if (!relativeTarget.includes('*')) {
    return [relativeTarget];
  }

  const normalized = relativeTarget.replace(/\\/g, '/');
  const slashIndex = normalized.lastIndexOf('/');
  const baseDir = slashIndex >= 0 ? normalized.slice(0, slashIndex) : '.';
  const pattern = slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
  const absoluteBaseDir = path.resolve(cwd, baseDir);
  if (!fs.existsSync(absoluteBaseDir) || !fs.lstatSync(absoluteBaseDir).isDirectory()) {
    return [];
  }

  const regex = new RegExp(`^${pattern.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
  return fs.readdirSync(absoluteBaseDir)
    .filter((entry) => regex.test(entry))
    .map((entry) => (baseDir === '.' ? entry : `${baseDir}/${entry}`));
}

function runCleanup(options, cwd = process.cwd()) {
  const actions = [];
  let reclaimedBytes = 0;

  for (const configuredTarget of TARGETS) {
    const expandedTargets = expandTarget(cwd, configuredTarget);
    for (const relativeTarget of expandedTargets) {
      const resolved = path.resolve(cwd, relativeTarget);
      if (!fs.existsSync(resolved)) continue;
      const bytes = statSizeBytes(resolved);
      reclaimedBytes += bytes;
      actions.push({
        path: relativeTarget,
        exists: true,
        bytes,
        action: options.apply ? 'removed' : 'would-remove',
      });
      if (options.apply) {
        removeTarget(resolved);
      }
    }
  }

  return {
    applied: options.apply,
    reclaimedBytes,
    reclaimedMb: Number((reclaimedBytes / 1024 / 1024).toFixed(2)),
    actions,
  };
}

function formatHumanReport(result) {
  const lines = ['HomeLand workspace cleanup', ''];
  for (const action of result.actions) {
    lines.push(`[${action.action}] ${action.path} (${(action.bytes / 1024 / 1024).toFixed(2)} MB)`);
  }
  lines.push('', `Reclaimed: ${result.reclaimedMb} MB`);
  return lines.join('\n');
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  const result = runCleanup(options);
  process.stdout.write(`${options.json ? JSON.stringify(result, null, 2) : formatHumanReport(result)}\n`);
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`Workspace cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  TARGETS,
  formatHumanReport,
  parseArguments,
  runCleanup,
};
