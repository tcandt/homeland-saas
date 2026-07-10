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
const manifestPath = path.join(runDir, 'execution-manifest.json');
if (!fs.existsSync(manifestPath)) {
    console.error("execution-manifest.json not found");
    process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

// Keys
const keysDir = path.resolve(__dirname, '../../.eos/keys');
const privateKeyPath = path.join(keysDir, 'private.pem');
const publicKeyPath = path.join(keysDir, 'public.pem');

if (!fs.existsSync(privateKeyPath)) {
    console.error("Keypair not found. Cannot sign attestation.");
    process.exit(1);
}

const privateKey = crypto.createPrivateKey(fs.readFileSync(privateKeyPath));
const publicKey = crypto.createPublicKey(fs.readFileSync(publicKeyPath)).export({type: 'spki', format: 'pem'}).toString();

const stageResults: Record<string, any> = {};
const stages = ['verify_prod', 'backend_build', 'frontend_build', 'unit_test', 'integration_test'];

for (const stage of stages) {
    const stageDir = path.join(runDir, `${stage}-attempt-1`);
    if (fs.existsSync(stageDir)) {
        const ev = JSON.parse(fs.readFileSync(path.join(stageDir, 'evidence.json'), 'utf-8'));
        stageResults[stage] = { evidence: ev };
    }
}

const attestationPayload = {
    schemaVersion: "3.5",
    executionId,
    epicId: manifest.epicId,
    trustProfile: manifest.trustProfile,
    signerType: "Ed25519",
    signerIdentity: publicKey,
    trustAnchorId: "local://keys/public.pem",
    signatureAlgorithm: "EdDSA",
    manifest,
    stageResults
};

const payloadStr = JSON.stringify(attestationPayload);
const signature = crypto.sign(null, Buffer.from(payloadStr), privateKey).toString('base64');

fs.writeFileSync(path.join(runDir, 'attestation.json'), JSON.stringify(attestationPayload, null, 2));
fs.writeFileSync(path.join(runDir, 'attestation.sig'), signature);
console.log(`Attestation generated and signed for ${executionId}`);
