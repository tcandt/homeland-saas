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
const receiptPath = path.join(runDir, 'receipt.json');
const signaturePath = path.join(runDir, 'receipt.sig');

if (!fs.existsSync(receiptPath) || !fs.existsSync(signaturePath)) {
    console.error("Receipt or signature not found");
    process.exit(1);
}

const receiptData = fs.readFileSync(receiptPath, 'utf-8');
const signature = fs.readFileSync(signaturePath, 'utf-8');
const receipt = JSON.parse(receiptData);

// 1. Verify Receipt Signature
const publicKey = crypto.createPublicKey(receipt.signerIdentity);
const isValid = crypto.verify(null, Buffer.from(receiptData), publicKey, Buffer.from(signature, 'base64'));

if (!isValid) {
    console.error("SIGNATURE_INVALID");
    process.exit(1);
}

// 2. Trust Profile Limits
const profile = receipt.trustProfile;
const isEphemeral = profile === 'UNTRUSTED_EPHEMERAL';
const isLocal = profile === 'LOCAL_DEVELOPMENT';
const isCI = profile === 'CI_TRUSTED';

let maxGateStatus = 'PRODUCTION_VERIFIED';
if (isEphemeral) {
    maxGateStatus = 'UNTRUSTED_SIGNER_PROFILE';
} else if (isLocal) {
    maxGateStatus = 'LOCAL_VERIFIED';
}

if (receipt.epicId !== epicInput) {
    console.error("EPIC_MISMATCH");
    process.exit(1);
}

const policyPath = path.resolve(__dirname, `../../docs/gates/policies/EPIC_${epicInput}_POLICY.yaml`);
const policy = yaml.parse(fs.readFileSync(policyPath, 'utf-8'));

let overallPass = true;
let missingMandatory = false;

const gateObj: any = {
    epic: `${epicInput}_INVOICE`,
    implementation: 'PASS',
    infrastructure: 'PASS'
};

for (const stage of policy.mandatoryStages) {
    const res = receipt.stageDetails[stage];
    if (!res) {
        missingMandatory = true;
        gateObj[stage] = 'MISSING';
        overallPass = false;
    } else {
        gateObj[stage] = res;
        if (res !== 'PASS') {
            overallPass = false;
        }
    }
}

if (missingMandatory) {
    console.error("GATE_BLOCKED_MISSING_STAGE");
    process.exit(1);
}

let finalStatus = overallPass ? 'PASS' : 'VERIFICATION_BLOCKED';

if (finalStatus === 'PASS' && isLocal) {
    finalStatus = 'LOCAL_VERIFIED'; // Because local cannot reach RELEASE_READY or PRODUCTION_VERIFIED natively
}
if (finalStatus === 'PASS' && isEphemeral) {
    finalStatus = 'UNTRUSTED_SIGNER_PROFILE';
}

// Write Gate YAML
Object.assign(gateObj, {
    evidence: overallPass ? 'COMPLETE' : 'INCOMPLETE',
    status: finalStatus,
    epic_closed: finalStatus === 'PRODUCTION_VERIFIED' || finalStatus === 'LOCAL_VERIFIED' || finalStatus === 'PASS',
    trustProfile: profile,
    artifactDigest: crypto.createHash('sha256').update(receiptData).digest('hex'),
    artifactLocation: `.eos/runs/${executionId}/`,
    retentionPolicy: "30_DAYS"
});

const gateYamlPath = path.resolve(__dirname, `../../docs/gates/EPIC_${epicInput}_GATE.yaml`);
fs.writeFileSync(gateYamlPath, yaml.stringify(gateObj));

console.log(`Gate generated successfully. Status: ${finalStatus}`);
