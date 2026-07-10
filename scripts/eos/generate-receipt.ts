import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import minimist from 'minimist';

const args = minimist(process.argv.slice(2));
const executionId = args['execution-id'];
let epicInput = args.epic;

if (!executionId || !epicInput) {
    console.error("Please provide --execution-id and --epic");
    process.exit(1);
}
epicInput = String(epicInput).padStart(2, '0');

const runDir = path.resolve(__dirname, `../../docs/evidence/runs/${executionId}`);
const validationResultPath = path.join(runDir, 'validation-result.json');

if (!fs.existsSync(validationResultPath)) {
    console.error("validation-result.json not found. Did you run eos:validate?");
    process.exit(1);
}

const validationData = JSON.parse(fs.readFileSync(validationResultPath, 'utf-8'));

if (validationData.epicId !== epicInput) {
    console.error(`Validation epic ${validationData.epicId} does not match ${epicInput}`);
    process.exit(1);
}

const epicDirName = epicInput + '_INVOICE';

let stageDetails = '';
const evidenceHashes: Record<string, string> = {};

for (const stage of Object.keys(validationData.results)) {
    const r = validationData.results[stage];
    stageDetails += `\n[${stage.toUpperCase()}]\n  Authenticity: ${r.authenticity}\n  StageResult: ${r.stageResult}`;
    if (r.reason) {
        stageDetails += `\n  Reason: ${r.reason}`;
    }
    if (r.evidenceJson) {
        evidenceHashes[stage] = crypto.createHash('sha256').update(JSON.stringify(r.evidenceJson)).digest('hex');
    }
}

const receiptObj: any = {
    schemaVersion: "1.0",
    receiptId: `REC-${new Date().toISOString().replace(/\D/g,'').slice(0,14)}`,
    executionId,
    epicId: epicInput,
    epicDirName,
    generatedAtUtc: new Date().toISOString(),
    repositoryCommitSha: validationData.repositoryCommitSha,
    toolVersion: "eos-v3",
    validationResult: validationData.overallAuthenticity,
    sourceChangeReason: validationData.sourceChangeReason,
    evidenceHashes,
};

// JSON stringify canonically (keys sorted if we really want to, but standard stringify is deterministic enough if we do it here and then hash)
const payloadToHash = JSON.stringify(receiptObj);
const hash = crypto.createHash('sha256').update(payloadToHash, 'utf8').digest('hex');

receiptObj.receiptHash = hash;

const receiptJsonPath = path.join(runDir, 'receipt.json');
fs.writeFileSync(receiptJsonPath, JSON.stringify(receiptObj, null, 2));

const mdContent = `=== EXECUTION RECEIPT ===
Receipt ID: ${receiptObj.receiptId}
Hash: SHA256:${hash}
Epic: ${epicDirName}
Execution ID: ${executionId}
Validation Result: ${validationData.overallAuthenticity}
---
Stage Details: ${stageDetails}
=========================`;

fs.writeFileSync(path.join(runDir, 'receipt.md'), mdContent);
console.log(mdContent);

if (validationData.overallAuthenticity === 'INVALID') {
    process.exit(1);
}
