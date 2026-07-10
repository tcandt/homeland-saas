import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import minimist from 'minimist';

const args = minimist(process.argv.slice(2));
const executionId = args['execution-id'];

if (!executionId) {
    console.error("Please provide --execution-id");
    process.exit(1);
}

const runDir = path.resolve(__dirname, `../../.eos/runs/${executionId}`);
const attestationPath = path.join(runDir, 'attestation.json');
const signaturePath = path.join(runDir, 'attestation.sig');

if (!fs.existsSync(attestationPath) || !fs.existsSync(signaturePath)) {
    console.error("Attestation or signature not found");
    process.exit(1);
}

const attestationData = fs.readFileSync(attestationPath, 'utf-8');
const signature = fs.readFileSync(signaturePath, 'utf-8');
const att = JSON.parse(attestationData);

// 1. Verify signature
const publicKey = crypto.createPublicKey(att.signerIdentity);
const isValid = crypto.verify(null, Buffer.from(attestationData), publicKey, Buffer.from(signature, 'base64'));

if (!isValid) {
    console.error("SIGNATURE_INVALID");
    process.exit(1);
}

// 2. Verify Policy & Tool Hashes
const getHash = (p: string) => fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') : '';
const currentPolicyHash = getHash(path.resolve(__dirname, `../../docs/gates/policies/EPIC_${att.epicId}_POLICY.yaml`));
const currentOrchestratorHash = getHash(path.resolve(__dirname, 'verify-pipeline.ts'));

if (currentPolicyHash !== att.manifest.policyHash) {
    console.error("POLICY_HASH_MISMATCH");
    process.exit(1);
}
if (currentOrchestratorHash !== att.manifest.orchestratorToolHash) {
    console.error("TOOLCHAIN_HASH_MISMATCH");
    process.exit(1);
}

// 3. Verify stage outputs matches attestation
for (const stage of Object.keys(att.stageResults)) {
    const stageDir = path.join(runDir, `${stage}-attempt-1`);
    if (!fs.existsSync(stageDir)) {
        console.error(`EVIDENCE_UNAVAILABLE for ${stage}`);
        process.exit(1);
    }
    const stdoutSha = getHash(path.join(stageDir, 'stdout.log'));
    const expectedSha = att.stageResults[stage].evidence.stdoutSha256;
    if (stdoutSha !== expectedSha) {
        console.error("STDOUT_HASH_MISMATCH");
        process.exit(1);
    }
}

console.log("Attestation is VALID.");
