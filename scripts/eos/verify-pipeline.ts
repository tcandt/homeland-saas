import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import minimist from 'minimist';
import * as yaml from 'yaml';

const args = minimist(process.argv.slice(2));
const epicInput = String(args.epic || '04').padStart(2, '0');
const profileInput = args.profile || 'LOCAL_DEVELOPMENT';

// Ensure .eos/runs exists
const runDirBase = path.resolve(__dirname, '../../.eos/runs');
if (!fs.existsSync(runDirBase)) fs.mkdirSync(runDirBase, { recursive: true });

// Setup Keys
const keysDir = path.resolve(__dirname, '../../.eos/keys');
if (!fs.existsSync(keysDir)) fs.mkdirSync(keysDir, { recursive: true });
const privateKeyPath = path.join(keysDir, 'private.pem');
const publicKeyPath = path.join(keysDir, 'public.pem');
if (!fs.existsSync(privateKeyPath)) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(privateKeyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
    fs.writeFileSync(publicKeyPath, publicKey.export({ type: 'spki', format: 'pem' }));
}
const privateKey = crypto.createPrivateKey(fs.readFileSync(privateKeyPath));
const publicKey = crypto.createPublicKey(fs.readFileSync(publicKeyPath)).export({type: 'spki', format: 'pem'}).toString();

const executionId = `RUN-${new Date().toISOString().replace(/\D/g, '').slice(0,14)}`;
const execPath = path.join(runDirBase, executionId);
fs.mkdirSync(execPath);

console.log(`Starting EOS v3.5 Pipeline for Epic ${epicInput}`);
console.log(`Execution ID: ${executionId}`);
console.log(`Profile: ${profileInput}`);

// 1. Tool and Policy Hashing
const getHash = (p: string) => fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') : '';
const policyPath = path.resolve(__dirname, `../../docs/gates/policies/EPIC_${epicInput}_POLICY.yaml`);
const policyHash = getHash(policyPath);
const orchestratorHash = getHash(__filename);

// 2. Provenance Gathering
const gitSha = execSync('git rev-parse HEAD').toString().trim();
const isDirty = execSync('git status --porcelain').toString().trim().length > 0;
const packageJsonSha = getHash(path.resolve(__dirname, '../../package.json'));
const lockfileSha = getHash(path.resolve(__dirname, '../../package-lock.json'));

const manifest = {
    schemaVersion: "3.5",
    executionId,
    epicId: epicInput,
    trustProfile: profileInput,
    repositoryCommitSha: gitSha,
    gitWorkingTreeClean: !isDirty,
    packageJsonSha256: packageJsonSha,
    lockfileSha256: lockfileSha,
    nodeVersion: process.version,
    osPlatform: process.platform,
    policyHash,
    orchestratorToolHash: orchestratorHash
};
fs.writeFileSync(path.join(execPath, 'execution-manifest.json'), JSON.stringify(manifest, null, 2));

// 3. Validate Trust Policy
if (!fs.existsSync(policyPath)) {
    console.error("Policy not found.");
    process.exit(1);
}
const policy = yaml.parse(fs.readFileSync(policyPath, 'utf-8'));

// 4. Run Allowlisted Stages & Record Raw Outputs
const allowlist: Record<string, string> = {
    "verify_prod": "npm run verify:prod",
    "backend_build": "npm run build --workspace=api",
    "frontend_build": "npm run build --workspace=web",
    "unit_test": "npm run test --workspace=api",
    "integration_test": "npm run test:e2e --workspace=api"
};

const stageResults: Record<string, any> = {};

for (const stage of policy.mandatoryStages) {
    console.log(`Running stage: ${stage}`);
    const cmd = allowlist[stage];
    if (!cmd) {
        console.error(`Stage ${stage} not in allowlist!`);
        process.exit(1);
    }
    
    const [command, ...cmdArgs] = cmd.split(' ');
    
    const stageDir = path.join(execPath, `${stage}-attempt-1`);
    fs.mkdirSync(stageDir);
    
    const child = spawnSync(command, cmdArgs, { 
        cwd: path.resolve(__dirname, '../../'),
        shell: true 
    });
    
    const stdoutStr = child.stdout ? child.stdout.toString() : '';
    const stderrStr = child.stderr ? child.stderr.toString() : '';
    
    fs.writeFileSync(path.join(stageDir, 'stdout.log'), stdoutStr);
    fs.writeFileSync(path.join(stageDir, 'stderr.log'), stderrStr);
    
    const stdoutSha = crypto.createHash('sha256').update(stdoutStr).digest('hex');
    const stderrSha = crypto.createHash('sha256').update(stderrStr).digest('hex');
    
    const ev = {
        executionId,
        resolvedCommand: cmd,
        exitCode: child.status ?? 1,
        finishedAtUtc: new Date().toISOString(),
        stdoutSha256: stdoutSha,
        stderrSha256: stderrSha
    };
    fs.writeFileSync(path.join(stageDir, 'evidence.json'), JSON.stringify(ev, null, 2));
    
    stageResults[stage] = {
        evidence: ev,
        stageDir
    };
}

// 5. Generate Attestation
const attestationPayload = {
    schemaVersion: "3.5",
    executionId,
    epicId: epicInput,
    trustProfile: profileInput,
    signerType: "Ed25519",
    signerIdentity: publicKey,
    trustAnchorId: "local://keys/public.pem",
    signatureAlgorithm: "EdDSA",
    manifest,
    stageResults
};

const payloadStr = JSON.stringify(attestationPayload);
const signature = crypto.sign(null, Buffer.from(payloadStr), privateKey).toString('base64');

fs.writeFileSync(path.join(execPath, 'attestation.json'), JSON.stringify(attestationPayload, null, 2));
fs.writeFileSync(path.join(execPath, 'attestation.sig'), signature);

console.log("Attestation generated and signed.");

// 6. Next we will chain receipts and gates, but for now we finish commit 2.
