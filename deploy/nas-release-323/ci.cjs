const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const a = require('node:assert/strict');
const sha = process.argv[2];
const runId = process.argv[3];
a.match(sha || '', /^[a-f0-9]{40}$/);
a.match(runId || '', /^\d+$/);
async function main() {
  const credential = cp.execFileSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  });
  const token = credential.split('\n').find(line => line.startsWith('password='))?.slice(9);
  a.ok(token, 'GitHub credential unavailable');
  const api = async suffix => {
    const response = await fetch(`https://api.github.com/repos/tcandt/homeland-saas/actions/runs/${runId}${suffix}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(30000),
    });
    a.equal(response.status, 200); return response.json();
  };
  const run = await api('');
  a.equal(run.head_sha, sha);
  const result = await api('/jobs?per_page=100');
  a.equal(result.jobs.length, result.total_count);
  const jobs = result.jobs.map(({ name, status, conclusion }) => ({ name, status, conclusion }));
  const gate = { sha, runId: run.id, url: run.html_url, status: run.status, conclusion: run.conclusion, jobs };
  console.log(JSON.stringify(gate));
  if (run.status !== 'completed') return;
  a.equal(run.conclusion, 'success');
  for (const name of ['Lint', 'Type Check', 'Unit Test', 'Integration Test', 'Build Web', 'Build API', 'Security & Supply Chain Scan', 'E2E Tests']) {
    a.equal(jobs.find(job => job.name === name)?.conclusion, 'success', name);
  }
  fs.writeFileSync(path.join(__dirname, 'ci-gate.json'), JSON.stringify({ ...gate, capturedAt: new Date().toISOString() }, null, 2) + '\n', { flag: 'wx' });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
