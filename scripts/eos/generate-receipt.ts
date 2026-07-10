import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import minimist from 'minimist';

const args = minimist(process.argv.slice(2));
const executionId = args['execution-id'];
const epicInput = String(args.epic || '04').padStart(2, '0');

if (!executionId) {
    console.error("Please provide --execution-id");
    process.exit(1);
}

const runDirBase = path.resolve(__dirname, '../../.eos/runs');
const runDir = path.join(runDirBase, executionId);
const attestationPath = path.join(runDir, 'attestation.json');

if (!fs.existsSync(attestationPath)) {
    console.error("attestation.json not found");
    process.exit(1);
}

const att = JSON.parse(fs.readFileSync(attestationPath, 'utf-8'));

// Keys
const keysDir = path.resolve(__dirname, '../../.eos/keys');
const privateKeyPath = path.join(keysDir, 'private.pem');
if (!fs.existsSync(privateKeyPath)) {
    console.error("Keypair not found.");
    process.exit(1);
}
const privateKey = crypto.createPrivateKey(fs.readFileSync(privateKeyPath));

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
            // The chainHeadHash points to an external anchor. Since this is local, we just copy it or set it.
            chainHeadHash = prev.chainHeadHash || "LOCAL_ANCHOR";
            break;
        }
    }
}

// Map stage results to overall pass/fail
let allPass = true;
const stageDetails: any = {};
for (const stage of Object.keys(att.stageResults)) {
    const exitCode = att.stageResults[stage].evidence.exitCode;
    const stdoutPath = path.join(runDir, `${stage}-attempt-1`, 'stdout.log');
    const stdout = fs.existsSync(stdoutPath) ? fs.readFileSync(stdoutPath, 'utf8') : '';
    
    let result = exitCode === 0 ? "PASS" : "FAIL";
    if (stage === 'verify_prod' && result === "PASS") {
        if (!stdout.includes('Verification PASSED.')) result = "FAIL";
        if (stdout.includes('Error: P1001')) result = "FAIL"; // Example failure marker check
    }
    stageDetails[stage] = result;
    if (result !== "PASS") allPass = false;
}

const receiptPayload = {
    schemaVersion: "3.5",
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
    provenance: {
        repositoryUrl: att.manifest.repositoryUrl,
        repositoryCommitSha: att.manifest.repositoryCommitSha,
        policyHash: att.manifest.policyHash,
        orchestratorToolHash: att.manifest.orchestratorToolHash
    },
    validationResult: allPass ? 'VALID' : 'INVALID',
    stageDetails
};

const payloadStr = JSON.stringify(receiptPayload);
const signature = crypto.sign(null, Buffer.from(payloadStr), privateKey).toString('base64');

fs.writeFileSync(path.join(runDir, 'receipt.json'), JSON.stringify(receiptPayload, null, 2));
fs.writeFileSync(path.join(runDir, 'receipt.sig'), signature);
console.log(`Receipt generated and signed for ${executionId}`);

const runIndex = {
    executionId,
    timestamp: new Date().toISOString(),
    status: allPass ? 'SUCCESS' : 'FAILURE',
    receiptHash: crypto.createHash('sha256').update(payloadStr).digest('hex')
};
fs.writeFileSync(path.join(runDir, 'run-index.json'), JSON.stringify(runIndex, null, 2));
