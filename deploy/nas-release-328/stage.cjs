const cp = require('node:child_process');
const fs = require('node:fs');
const a = require('node:assert/strict');
const git = args => cp.execFileSync('git', args, { encoding: 'utf8' });
a.equal(git(['diff', '--cached', '--name-only']).trim(), '', 'Preserve existing staged work');
const files = [
  '.env.example', '.env.docker.example', 'package.json', 'package-lock.json', 'apps/api/package.json', 'apps/web/package.json',
  'deploy/public-production/docker-compose.registry-production.yml',
  'apps/api/src/system-update/system-update.service.ts', 'apps/api/src/system-update/system-update.service.spec.ts',
  'apps/web/components/settings/sections/SettingsBackup.tsx', 'testing/operational-reset.browser.cjs',
  'apps/web/components/contracts/OperationsContractRow.tsx', 'apps/web/lib/contracts/booking-conversion.ts',
  'apps/web/tests/unit/contract-row-grouping.test.ts', 'apps/web/tests/unit/booking-terminal-drawer.test.ts',
  'testing/booking-cancellation.browser.cjs', 'docs/evidence/LOCAL_3_2_7_BOOKING_CANCEL_STATUS_20261021.md',
  'docs/evidence/RELEASE_3_2_9_PREPARED_20261024.md',
];
git(['add', '--', ...files]);
const file = 'apps/web/components/contracts/OperationsContractDrawer.tsx';
const chunks = git(['diff', '--', file]).split(/(?=^@@ )/m);
const selected = chunks.slice(1).filter(hunk => [2194, 2385, 2396, 2505, 2574].includes(Number(hunk.match(/^@@ -(\d+)/)[1])));
a.equal(selected.length, 5, 'Unexpected drawer hunk count');
cp.execFileSync('git', ['apply', '--cached', '--recount', '-'], { input: chunks[0] + selected.join(''), encoding: 'utf8' });
const todo = 'docs/operations/GO_LIVE_TODO.md';
const entry = '- `RELEASE3.2.9 PREPARED / DEPLOYMENT PENDING` 24/10/2026: scoped operational-reset and terminal booking-status fixes prepared; preserve Hunonic mappings/payment routes and fixed building/room data, optional backup when unconfigured and explicit confirmation safeguards. Earlier focused API35/35, Web93/93, mocked reset4/4 and booking6/6, API/Web typechecks PASS. Exact staged candidate CI and NAS acceptance pending. No production reset/migration; PostgreSQL reset FK/trigger/rollback acceptance unverified. CORE10/GATE10 and provider/payment gates remain OPEN. Evidence: `docs/evidence/RELEASE_3_2_9_PREPARED_20261024.md`.';
const content = git(['show', `HEAD:${todo}`]).replace(/(# HomeLand Go-Live TODO\r?\n)/, `$1\n${entry}\n`);
const blob = cp.execFileSync('git', ['hash-object', '-w', '--stdin'], { input: content, encoding: 'utf8' }).trim();
git(['update-index', '--cacheinfo', `100644,${blob},${todo}`]);
const scripts = fs.readdirSync(__dirname).filter(name => /\.(cjs|sh)$/.test(name)).map(name => `deploy/nas-release-328/${name}`);
git(['add', '--', ...scripts]);
console.log(git(['diff', '--cached', '--stat']));
