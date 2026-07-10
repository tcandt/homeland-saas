import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import minimist from 'minimist';

const args = minimist(process.argv.slice(2));
let epicInput = args.epic;
if (!epicInput) {
    console.error('Please provide an --epic flag, e.g., --epic=04');
    process.exit(1);
}
epicInput = String(epicInput).padStart(2, '0');

const date = new Date().toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z';
const randomStr = crypto.randomBytes(16).toString('hex');
const executionId = `RUN-${date}-${randomStr}`;

let repositoryCommitSha = 'unknown';
let gitWorkingTreeClean = false;
try {
    repositoryCommitSha = execSync('git rev-parse HEAD').toString().trim();
    const status = execSync('git status --porcelain').toString().trim();
    gitWorkingTreeClean = status.length === 0;
} catch (e) {
    console.error('Warning: Could not get git status.');
}

const manifest = {
    executionId,
    epicId: epicInput,
    createdAtUtc: new Date().toISOString(),
    createdByTool: 'eos:start',
    repositoryCommitSha,
    gitWorkingTreeClean,
    nodeVersion: process.version,
    npmVersion: execSync('npm -v').toString().trim(),
    platform: process.platform,
    status: 'RUNNING'
};

const runDir = path.resolve(__dirname, '../../docs/evidence/runs/' + executionId);
fs.mkdirSync(runDir, { recursive: true });
fs.writeFileSync(path.join(runDir, 'execution-manifest.json'), JSON.stringify(manifest, null, 2));

console.log(executionId);
