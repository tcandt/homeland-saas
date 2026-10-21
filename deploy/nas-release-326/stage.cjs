const cp = require('node:child_process');
const fs = require('node:fs');
const a = require('node:assert/strict');
const git = args => cp.execFileSync('git', args, { encoding: 'utf8' });
a.equal(git(['diff', '--cached', '--name-only']).trim(), '', 'Preserve any existing staged work');
const files = [
  '.env.example', '.env.docker.example', 'package.json', 'package-lock.json', 'apps/api/package.json', 'apps/web/package.json',
  'deploy/public-production/docker-compose.registry-production.yml',
  'apps/api/src/payments/payments.service.ts', 'apps/api/src/payments/payments.service.spec.ts',
  'apps/api/src/automation/workflow/workflow.engine.ts', 'apps/api/src/automation/workflow/workflow.engine.spec.ts',
  'apps/api/src/communication/services/zalo-registration.service.ts', 'apps/api/src/communication/services/zalo-registration.service.spec.ts',
  'apps/api/src/communication/templates/notification-template-catalog.ts',
  'apps/web/lib/contracts/booking-cancellation.ts', 'apps/web/tests/unit/booking-cancellation.test.ts', 'testing/booking-cancellation.browser.cjs',
  'apps/web/lib/contracts/contract-birth-date.ts', 'apps/web/lib/contracts/contract-birth-date.test.ts',
  'apps/web/app/api/export-contract/route.ts', 'apps/web/app/api/export-compiled-pdf/route.ts',
  'apps/web/components/contracts/PreviewContractModal.tsx', 'apps/web/tests/unit/preview-contract-modal.test.ts',
  'apps/web/tests/unit/compiled-pdf-export.test.ts', 'apps/web/tests/unit/export-contract-birth-date.test.ts',
  'docs/evidence/LOCAL_3_2_4_BOOKING_CANCELLATION_20261021.md',
  'docs/evidence/LOCAL_3_2_5_ZALO_QR_SCOPE_20261021.md', 'docs/evidence/LOCAL_3_2_6_CONTRACT_BIRTH_DATE_20261021.md',
];
git(['add', '--', ...files]);
function partial(file, select, expected) {
  const diff = git(['diff', '--', file]);
  const chunks = diff.split(/(?=^@@ )/m);
  const selected = chunks.slice(1).filter(select);
  a.equal(selected.length, expected, `${file}: unexpected selected hunk count`);
  cp.execFileSync('git', ['apply', '--cached', '--recount', '-'], {
    input: chunks[0] + selected.join(''), encoding: 'utf8',
  });
}
partial('apps/web/components/buildings/RoomPremiumModal.tsx', hunk =>
  /\+.*resolveContractBirthDate|\+.*primaryCustomer|^-\s*ngaySinh: rep\.birthDate/m.test(hunk), 3);
partial('apps/web/components/contracts/OperationsContractDrawer.tsx', hunk =>
  !/StyledDateInput|CONTRACT_SECURITY_DEPOSIT_BALANCE_INSUFFICIENT|^\+\s*(id|max)[,?:=]/m.test(hunk), 16);
const todo = 'docs/operations/GO_LIVE_TODO.md';
const oldTodo = git(['show', `HEAD:${todo}`]);
const entries = fs.readFileSync(todo, 'utf8').split(/\r?\n/).filter(line => /^- `LOCAL3\.2\.[456] /.test(line));
a.equal(entries.length, 3);
const content = oldTodo.replace(/(# HomeLand Go-Live TODO\r?\n)/, `$1\n${entries.join('\n\n')}\n`);
const blob = cp.execFileSync('git', ['hash-object', '-w', '--stdin'], { input: content, encoding: 'utf8' }).trim();
git(['update-index', '--cacheinfo', `100644,${blob},${todo}`]);
const scripts = fs.readdirSync(__dirname).filter(name => /\.(cjs|sh)$/.test(name)).map(name => `deploy/nas-release-326/${name}`);
git(['add', '--', ...scripts]);
console.log(git(['diff', '--cached', '--stat']));
