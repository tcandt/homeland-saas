import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import minimist from 'minimist';
import * as yaml from 'yaml';
import { EventLogger } from './event-logger';
import { captureSupplyChainAndRuntime } from './provenance-capture';

const args = minimist(process.argv.slice(2));
const epicInput = String(args.epic || '04').padStart(2, '0');
const profileInput = args.profile || 'LOCAL_DEVELOPMENT';

// Setup Execution ID and paths
const runDirBase = path.resolve(__dirname, '../../.eos/runs');
if (!fs.existsSync(runDirBase)) fs.mkdirSync(runDirBase, { recursive: true });

const executionId = `RUN-${new Date().toISOString().replace(/\D/g, '').slice(0,14)}`;
const execPath = path.join(runDirBase, executionId);
fs.mkdirSync(execPath);

console.log(`Starting EOS v5 Pipeline for Epic ${epicInput}`);
console.log(`Execution ID: ${executionId}`);
console.log(`Profile: ${profileInput}`);

// Initialize Event Logger
const logger = new EventLogger(executionId);
logger.append('PIPELINE_STARTED', { epicId: epicInput, trustProfile: profileInput });

// Supply Chain & Provenance Capture
const provenance = captureSupplyChainAndRuntime();
const manifest = {
    schemaVersion: "5.0",
    executionId,
    epicId: epicInput,
    trustProfile: profileInput,
    provenance,
    policyHash: crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, `../../docs/gates/policies/EPIC_${epicInput}_POLICY.yaml`))).digest('hex'),
    orchestratorToolHash: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex')
};
fs.writeFileSync(path.join(execPath, 'execution-manifest.json'), JSON.stringify(manifest, null, 2));
logger.append('MANIFEST_GENERATED', { manifestPath: 'execution-manifest.json' }, ['execution-manifest.json']);

// Keys
const keysDir = path.resolve(__dirname, '../../.eos/keys');
const privateKeyPath = path.join(keysDir, 'private.pem');
const privateKey = crypto.createPrivateKey(fs.readFileSync(privateKeyPath));
const publicKey = crypto.createPublicKey(fs.readFileSync(path.join(keysDir, 'public.pem'))).export({type: 'spki', format: 'pem'}).toString();

const policyPath = path.resolve(__dirname, `../../docs/gates/policies/EPIC_${epicInput}_POLICY.yaml`);
if (!fs.existsSync(policyPath)) {
    console.error("Policy not found.");
    process.exit(1);
}
const policy = yaml.parse(fs.readFileSync(policyPath, 'utf-8'));

// Run Stages
const allowlist: Record<string, string> = {
    "verify_prod": "npm run verify:prod",
    "backend_build": "npm run build --workspace=api",
    "frontend_build": "npm run build --workspace=web",
    "unit_test": "npm run test --workspace=api",
    "integration_test": "npm run test:e2e --workspace=api"
};

const stageResults: Record<string, any> = {};

for (const stage of policy.requiresStages || []) {
    logger.append('STAGE_STARTED', { stage });
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
    
    const outLogRel = `${stage}-attempt-1/stdout.log`;
    const errLogRel = `${stage}-attempt-1/stderr.log`;
    
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
    
    logger.append('STAGE_FINISHED', { stage, exitCode: ev.exitCode, stdoutSha256: ev.stdoutSha256 }, [outLogRel]);
    
    stageResults[stage] = {
        evidence: ev,
        stageDir
    };
}


// Verify Supply Chain at end of execution
const postProv = captureSupplyChainAndRuntime();
for (const [tool, details] of Object.entries(manifest.provenance.supplyChain)) {
    if (postProv.supplyChain[tool]?.sha256 !== (details as any).sha256) {
        console.error('SUPPLY_CHAIN_TAMPERED');
        process.exit(1);
    }
}

// Generate Attestation

const attestationPayload = {
    schemaVersion: "5.0",
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

const payloadStr = JSON.stringify(attestationPayload, null, 2);
const signature = crypto.sign(null, Buffer.from(payloadStr), privateKey).toString('base64');

fs.writeFileSync(path.join(execPath, 'attestation.json'), payloadStr);
fs.writeFileSync(path.join(execPath, 'attestation.sig'), signature);

logger.append('ATTESTATION_GENERATED', { attestationPath: 'attestation.json' }, ['attestation.json', 'attestation.sig']);

console.log("Attestation generated and signed.");

// Run verifications and generators
execSync(`npx tsx scripts/eos/verify-event-log.ts --execution-id=${executionId}`, { stdio: 'inherit' });
execSync(`npx tsx scripts/eos/generate-receipt.ts --execution-id=${executionId} --epic=${epicInput}`, { stdio: 'inherit' });
execSync(`npx tsx scripts/eos/policy-engine.ts --execution-id=${executionId} --epic=${epicInput}`, { stdio: 'inherit' });
execSync(`npx tsx scripts/eos/generate-gate.ts --execution-id=${executionId} --epic=${epicInput}`, { stdio: 'inherit' });
execSync(`npx tsx scripts/eos/generate-dashboard.ts`, { stdio: 'inherit' });

console.log('Pipeline completed.');

