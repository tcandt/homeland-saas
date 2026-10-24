const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const a = require('node:assert/strict');
const sha = process.argv[2];
const runId = process.argv[3];
const TRUSTED_REPOSITORY = 'tcandt/homeland-saas';
const TRUSTED_REF = 'refs/heads/main';
const TRUSTED_WORKFLOW_PATH = '.github/workflows/ci-cd-pipeline.yml';
const REQUIRED_JOBS = ['Lint', 'Type Check', 'Unit Test', 'Integration Test', 'Build Web', 'Build API', 'Security & Supply Chain Scan', 'E2E Tests'];

function assertTrustedRun(run, expectedSha) {
  a.equal(run.repository?.full_name, TRUSTED_REPOSITORY);
  a.equal(run.repository?.default_branch, 'main');
  a.equal(run.head_repository?.full_name, TRUSTED_REPOSITORY);
  a.equal(run.head_repository?.default_branch, 'main');
  a.equal(run.event, 'push');
  a.equal(run.ref, TRUSTED_REF);
  a.equal(run.head_branch, 'main');
  a.equal(run.head_sha, expectedSha);
  // GitHub's workflow-run payload exposes the workflow file as `path`.
  // `workflow_path` is not a documented field and would make a real run fail
  // closed even when it came from the trusted workflow.
  a.equal(run.path, TRUSTED_WORKFLOW_PATH);
  a.ok(Number.isInteger(run.workflow_id) && run.workflow_id > 0, 'workflow identity missing');
  a.ok(Number.isInteger(run.run_attempt) && run.run_attempt > 0, 'run attempt missing');
}

if (require.main === module) {
  a.match(sha || '', /^[a-f0-9]{40}$/);
  a.match(runId || '', /^\d+$/);
}
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
  assertTrustedRun(run, sha);
  const result = await api('/jobs?per_page=100');
  a.equal(result.jobs.length, result.total_count);
  const jobs = result.jobs.map(({ name, status, conclusion }) => ({ name, status, conclusion }));
  const gate = { sha, runId: run.id, url: run.html_url, status: run.status, conclusion: run.conclusion, jobs };
  console.log(JSON.stringify(gate));
  if (run.status !== 'completed') return;
  a.equal(run.conclusion, 'success');
  for (const name of REQUIRED_JOBS) {
    a.equal(jobs.find(job => job.name === name)?.conclusion, 'success', name);
  }
  fs.writeFileSync(path.join(__dirname, 'ci-gate.json'), JSON.stringify({ ...gate, capturedAt: new Date().toISOString() }, null, 2) + '\n', { flag: 'wx' });
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });

module.exports = { assertTrustedRun, REQUIRED_JOBS };
