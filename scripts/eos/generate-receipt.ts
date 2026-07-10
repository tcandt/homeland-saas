import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import minimist from 'minimist';
import { verifyEventLog } from './verify-event-log';
import { EOSv4Event } from './event-logger';

const args = minimist(process.argv.slice(2));
const executionId = args['execution-id'];
const epicInput = String(args.epic || '04').padStart(2, '0');

if (!executionId) {
    console.error("Please provide --execution-id");
    process.exit(1);
}

const runDirBase = path.resolve(__dirname, '../../.eos/runs');
const runDir = path.join(runDirBase, executionId);

// 1. Verify Event Log Integrity first
const integrity = verifyEventLog(executionId);
if (integrity !== 'VALID') {
    console.error(`EVENT_LOG_INTEGRITY_FAILED: ${integrity}`);
    process.exit(1);
}

const logPath = path.join(runDir, 'event.log');
const logContent = fs.readFileSync(logPath, 'utf8').trim().split('\n');
const events = logContent.map(line => JSON.parse(line) as EOSv4Event);
const finalEvent = events[events.length - 1];

// Find previous receipt
const allRuns = fs.readdirSync(runDirBase, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('RUN-') && d.name !== executionId)
    .map(d => d.name)
    .sort((a, b) => b.localeCompare(a)); // Descending

let previousReceiptHash = "GENESIS";
let chainSequence = 1;
let chainHeadHash = "GENESIS";

if (allRuns.length > 0) {
    for (const prevRun of allRuns) {
        const prevReceiptPath = path.join(runDirBase, prevRun, 'receipt.json');
        if (fs.existsSync(prevReceiptPath)) {
            const prev = JSON.parse(fs.readFileSync(prevReceiptPath, 'utf-8'));
            previousReceiptHash = crypto.createHash('sha256').update(JSON.stringify(prev)).digest('hex');
            chainSequence = prev.chainSequence + 1;
            chainHeadHash = prev.chainHeadHash || "LOCAL_ANCHOR";
            break;
        }
    }
}

// Ingest status details from STAGE_FINISHED events
const stageDetails: Record<string, string> = {};
let allPass = true;

for (const ev of events) {
    if (ev.eventType === 'STAGE_FINISHED') {
        const stage = ev.payload.stage;
        const exitCode = ev.payload.exitCode;
        const res = exitCode === 0 ? "PASS" : "FAIL";
        stageDetails[stage] = res;
        if (res !== "PASS") allPass = false;
    }
}

const keysDir = path.resolve(__dirname, '../../.eos/keys');
const privateKeyPath = path.join(keysDir, 'private.pem');
const privateKey = crypto.createPrivateKey(fs.readFileSync(privateKeyPath));

const att = JSON.parse(fs.readFileSync(path.join(runDir, 'attestation.json'), 'utf8'));

const receiptPayload = {
    schemaVersion: "5.0",
    receiptId: `REC-${executionId.replace('RUN-', '')}`,
    executionId,
    epicId: epicInput,
    trustProfile: att.trustProfile,
    signerType: att.signerType,
    signerIdentity: att.signerIdentity,
    trustAnchorId: att.trustAnchorId,
    signatureAlgorithm: att.signatureAlgorithm,
    chainSequence,
    previousReceiptHash,
    chainHeadHash,
    eventLogHeadHash: finalEvent.eventHash,
    provenance: {
        repositoryCommitSha: att.manifest.repositoryCommitSha,
        policyHash: att.manifest.policyHash,
        orchestratorToolHash: att.manifest.orchestratorToolHash
    },
    validationResult: allPass ? 'VALID' : 'INVALID',
    stageDetails
};

const payloadStr = JSON.stringify(receiptPayload, null, 2);
const signature = crypto.sign(null, Buffer.from(payloadStr), privateKey).toString('base64');

fs.writeFileSync(path.join(runDir, 'receipt.json'), payloadStr);
fs.writeFileSync(path.join(runDir, 'receipt.sig'), signature);

const runIndex = {
    executionId,
    timestamp: new Date().toISOString(),
    status: allPass ? 'SUCCESS' : 'FAILURE',
    receiptHash: crypto.createHash('sha256').update(payloadStr).digest('hex')
};
fs.writeFileSync(path.join(runDir, 'run-index.json'), JSON.stringify(runIndex, null, 2));

console.log(`Receipt generated and signed for ${executionId}`);
