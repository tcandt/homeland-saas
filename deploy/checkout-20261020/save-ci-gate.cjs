const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const credential = cp.execFileSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  });
  const token = credential.split('\n').find(x => x.startsWith('password='))?.slice(9);
  assert.ok(token, 'GitHub credential unavailable');
  const api = async suffix => {
    const response = await fetch(`https://api.github.com/repos/tcandt/homeland-saas/actions/runs/39404634819${suffix}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  const run = await api('');
  assert.equal(run.head_sha, '87aa24573fe3d7e0a5bbea7a44d042cf854c4e5d');
  assert.equal(run.conclusion, 'success', 'CI run must be complete and successful');
  const { jobs, total_count } = await api('/jobs?per_page=100');
  assert.equal(jobs.length, total_count);
  for (const name of ['Lint', 'Type Check', 'Unit Test', 'Integration Test', 'Build Web', 'Build API', 'Security & Supply Chain Scan', 'E2E Tests']) {
    assert.equal(jobs.find(x => x.name === name)?.conclusion, 'success', name);
  }
  const gate = { sha: run.head_sha, runId: run.id, url: run.html_url, conclusion: run.conclusion,
    capturedAt: new Date().toISOString(), jobs: jobs.map(({ name, conclusion }) => ({ name, conclusion })) };
  fs.writeFileSync(path.join(__dirname, 'ci-gate.json'), JSON.stringify(gate, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(gate));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
