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
if (!fs.existsSync(runDir)) {
    console.error(`Execution directory not found: ${runDir}`);
    process.exit(1);
}

const manifestPath = path.join(runDir, 'execution-manifest.json');
if (!fs.existsSync(manifestPath)) {
    console.error("execution-manifest.json not found");
    process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

if (manifest.epicId !== epicInput) {
    console.error(`Manifest epic ${manifest.epicId} does not match ${epicInput}`);
    process.exit(1);
}

const getHash = (filePath: string) => {
    if (!fs.existsSync(filePath)) return '';
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
};

const stages = ['verify_prod', 'backend_build', 'frontend_build', 'unit_test', 'integration_test'];
const results: Record<string, any> = {};

let overallValid = true;

for (const stage of stages) {
    const subdirs = fs.readdirSync(runDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name.startsWith(stage))
        .map(d => d.name)
        .sort((a, b) => b.localeCompare(a)); 

    if (subdirs.length === 0) {
        results[stage] = { valid: false, reason: "MISSING" };
        if (stage === 'verify_prod') { overallValid = false; }
        continue;
    }

    const latestDir = path.join(runDir, subdirs[0]);
    const evidenceJsonPath = path.join(latestDir, 'evidence.json');
    if (!fs.existsSync(evidenceJsonPath)) {
        results[stage] = { valid: false, reason: "EVIDENCE_JSON_MISSING" };
        overallValid = false;
        continue;
    }

    const evidence = JSON.parse(fs.readFileSync(evidenceJsonPath, 'utf-8'));
    
    const stdoutPath = path.join(latestDir, 'stdout.log');
    const stderrPath = path.join(latestDir, 'stderr.log');
    
    const actualStdoutHash = getHash(stdoutPath);
    const actualStderrHash = getHash(stderrPath);
    
    if (actualStdoutHash !== evidence.stdoutSha256) {
        results[stage] = { valid: false, reason: "STDOUT_HASH_MISMATCH" };
        overallValid = false;
        continue;
    }
    if (actualStderrHash !== evidence.stderrSha256) {
        results[stage] = { valid: false, reason: "STDERR_HASH_MISMATCH" };
        overallValid = false;
        continue;
    }

    const finishedAt = new Date(evidence.finishedAtUtc).getTime();
    const now = Date.now();
    if (now - finishedAt > 60 * 60 * 1000) {
        results[stage] = { valid: false, reason: "EVIDENCE_STALE" };
        overallValid = false;
        continue;
    }

    if (stage === 'verify_prod') {
        const stdoutStr = fs.readFileSync(stdoutPath, 'utf-8');
        if (!stdoutStr.includes('Verification PASSED.')) {
            results[stage] = { valid: false, reason: "MISSING_PASS_MARKER" };
            overallValid = false;
            continue;
        }
        
        const failMarkers = ["Verification FAILED", "P1001", "Timeout waiting", "Lifecycle script", "Process completed with exit code 1"];
        let hasFailMarker = false;
        const passIndex = stdoutStr.indexOf('Verification PASSED.');
        for (const m of failMarkers) {
            const failIndex = stdoutStr.indexOf(m);
            if (failIndex !== -1 && failIndex > passIndex) {
                hasFailMarker = true;
                break;
            }
        }
        if (hasFailMarker) {
            results[stage] = { valid: false, reason: "FAIL_MARKER_AFTER_PASS" };
            overallValid = false;
            continue;
        }

        if (evidence.exitCode !== 0) {
            results[stage] = { valid: false, reason: "NON_ZERO_EXIT" };
            overallValid = false;
            continue;
        }
    }

    results[stage] = { 
        valid: true, 
        evidenceJson: evidence,
        path: latestDir 
    };
}

console.log(JSON.stringify({
    executionId,
    epicId: epicInput,
    overallValid,
    results
}, null, 2));

if (!overallValid) {
    process.exit(1);
}
