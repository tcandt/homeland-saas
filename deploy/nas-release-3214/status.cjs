const cp = require('node:child_process');
const a = require('node:assert/strict');
async function main() {
  const credential = cp.execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const token = credential.split('\n').find(line => line.startsWith('password='))?.slice(9);
  a.ok(token);
  const sha = cp.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const api = async endpoint => {
    const response = await fetch(`https://api.github.com/repos/tcandt/homeland-saas/actions/${endpoint}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(30000) });
    a.equal(response.status, 200); return response.json();
  };
  const data = await api(`runs?head_sha=${sha}&per_page=5`);
  for (const run of data.workflow_runs) {
    const jobs = await api(`runs/${run.id}/jobs?per_page=100`);
    console.log(JSON.stringify({ sha, id: run.id, url: run.html_url, status: run.status, conclusion: run.conclusion, jobs: jobs.jobs.map(({ id, name, status, conclusion, steps }) => ({ id, name, status, conclusion, currentStep: steps?.find(s => s.status === 'in_progress')?.name, failedSteps: steps?.filter(s => s.conclusion === 'failure').map(s => s.name) })) }));
    if (process.argv[2] === '--failure-log') for (const job of jobs.jobs.filter(j => j.conclusion === 'failure')) {
      const response = await fetch(`https://api.github.com/repos/tcandt/homeland-saas/actions/jobs/${job.id}/logs`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
      a.equal(response.status, 200);
      const lines = (await response.text()).split('\n');
      if (job.name === 'E2E Tests') {
        const selected = new Set();
        lines.forEach((line, i) => {
          if (/\bfailed\b|Error:|TimeoutError|not enabled|contract-renewal|\d+ passed/.test(line))
            for (let k = Math.max(0, i - 2); k < Math.min(lines.length, i + 12); k++) selected.add(k);
        });
        console.log([...selected].sort((a,b) => a-b).map(i => lines[i]).join('\n'));
      } else console.log(lines.slice(-100).join('\n'));
    }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
