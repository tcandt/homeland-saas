import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import minimist from 'minimist';
import * as yaml from 'yaml';

const args = minimist(process.argv.slice(2));
const executionId = args['execution-id'];
const epicInput = String(args.epic || '04').padStart(2, '0');

if (!executionId) {
    console.error("Please provide --execution-id");
    process.exit(1);
}

const runDir = path.resolve(__dirname, `../../.eos/runs/${executionId}`);
const evalPath = path.join(runDir, 'policy-evaluation.json');

if (!fs.existsSync(evalPath)) {
    console.error("policy-evaluation.json not found");
    process.exit(1);
}

const evaluation = JSON.parse(fs.readFileSync(evalPath, 'utf-8'));

if (evaluation.epicId !== epicInput) {
    console.error("EPIC_MISMATCH");
    process.exit(1);
}

const gateObj = {
    epic: `${epicInput}_INVOICE`,
    status: evaluation.status,
    epic_closed: evaluation.status === 'PRODUCTION_VERIFIED' || evaluation.status === 'LOCAL_VERIFIED',
    decision: evaluation.decision,
    reasons: evaluation.reasons,
    evaluatedAtUtc: evaluation.evaluatedAtUtc,
    trustProfile: evaluation.trustProfile || 'LOCAL_DEVELOPMENT',
    policyHash: evaluation.policyHash,
    receiptHash: evaluation.receiptHash,
    artifactLocation: `.eos/runs/${executionId}/`
};

const gateYamlPath = path.resolve(__dirname, `../../docs/gates/EPIC_${epicInput}_GATE.yaml`);
fs.writeFileSync(gateYamlPath, yaml.stringify(gateObj));

console.log(`Gate generated successfully. Status: ${evaluation.status}`);
