import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
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

// Git commit binding check
let sourceChanged = false;
try {
    const currentSha = execSync('git rev-parse HEAD').toString().trim();
    if (currentSha !== manifest.repositoryCommitSha) {
        // Only allow changes in docs/evidence/**, docs/gates/**, or generated receipts/dashboards
        const diff = execSync(`git diff --name-only ${manifest.repositoryCommitSha} HEAD`).toString().split('\n').map(s => s.trim()).filter(s => s);
        for (const file of diff) {
            if (file.startsWith('apps/') || file.startsWith('packages/') || file.startsWith('scripts/') || file.startsWith('prisma/') || file.includes('package.json') || file.includes('lock')) {
                sourceChanged = true;
                break;
            }
        }
    }
} catch (e) {
    console.error("Warning: Git diff check failed.");
}

const getHash = (filePath: string) => {
    if (!fs.existsSync(filePath)) return '';
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
};

const stages = ['verify_prod', 'backend_build', 'frontend_build', 'unit_test', 'integration_test'];
const results: Record<string, any> = {};

let overallAuthenticity = sourceChanged ? 'INVALID' : 'VALID';
let sourceChangeReason = sourceChanged ? 'RUN_SOURCE_CHANGED' : null;

for (const stage of stages) {
    const subdirs = fs.readdirSync(runDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name.startsWith(stage))
        .map(d => d.name)
        .sort((a, b) => b.localeCompare(a)); 

    if (subdirs.length === 0) {
        results[stage] = { authenticity: "INVALID", stageResult: "BLOCKED", reason: "MISSING" };
        continue;
    }

    const latestDir = path.join(runDir, subdirs[0]);
    const evidenceJsonPath = path.join(latestDir, 'evidence.json');
    if (!fs.existsSync(evidenceJsonPath)) {
        results[stage] = { authenticity: "INVALID", stageResult: "BLOCKED", reason: "EVIDENCE_JSON_MISSING" };
        overallAuthenticity = "INVALID";
        continue;
    }

    let evidence;
    try {
        evidence = JSON.parse(fs.readFileSync(evidenceJsonPath, 'utf-8'));
    } catch {
        results[stage] = { authenticity: "INVALID", stageResult: "BLOCKED", reason: "EVIDENCE_JSON_CORRUPT" };
        overallAuthenticity = "INVALID";
        continue;
    }

    if (evidence.executionId !== manifest.executionId) {
        results[stage] = { authenticity: "INVALID", stageResult: "BLOCKED", reason: "EXECUTION_ID_MISMATCH" };
        overallAuthenticity = "INVALID";
        continue;
    }

    const stdoutPath = path.join(latestDir, 'stdout.log');
    const stderrPath = path.join(latestDir, 'stderr.log');
    
    const actualStdoutHash = getHash(stdoutPath);
    const actualStderrHash = getHash(stderrPath);
    
    if (actualStdoutHash !== evidence.stdoutSha256) {
        results[stage] = { authenticity: "INVALID", stageResult: "UNKNOWN", reason: "STDOUT_HASH_MISMATCH" };
        overallAuthenticity = "INVALID";
        continue;
    }
    if (actualStderrHash !== evidence.stderrSha256) {
        results[stage] = { authenticity: "INVALID", stageResult: "UNKNOWN", reason: "STDERR_HASH_MISMATCH" };
        overallAuthenticity = "INVALID";
        continue;
    }

    // Authenticity checks passed!
    let authenticity = "VALID";
    let reason = null;

    const finishedAt = new Date(evidence.finishedAtUtc).getTime();
    const now = Date.now();
    const maxEvidenceAgeMinutes = 60; // We can extract this from policy later if needed
    if (now - finishedAt > maxEvidenceAgeMinutes * 60 * 1000) {
        results[stage] = { authenticity: "INVALID", stageResult: "BLOCKED", reason: "EVIDENCE_STALE" };
        overallAuthenticity = "INVALID";
        continue;
    }

    let stageResult = evidence.exitCode === 0 ? "PASS" : "FAIL";
    if (stageResult === "FAIL") reason = "NON_ZERO_EXIT";

    if (stage === 'verify_prod') {
        if (!manifest.gitWorkingTreeClean) {
            stageResult = "BLOCKED";
            reason = "DIRTY_WORKING_TREE";
        }

        const stdoutStr = fs.readFileSync(stdoutPath, 'utf-8');
        if (!stdoutStr.includes('Verification PASSED.')) {
            stageResult = "FAIL";
            reason = "MISSING_PASS_MARKER";
        } else {
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
                stageResult = "FAIL";
                reason = "FAIL_MARKER_AFTER_PASS";
            }
        }
    }

    results[stage] = { 
        authenticity, 
        stageResult,
        reason,
        evidenceJson: evidence,
        path: latestDir 
    };
}

const validationResult = {
    schemaVersion: "1.0",
    executionId,
    epicId: epicInput,
    generatedAtUtc: new Date().toISOString(),
    repositoryCommitSha: manifest.repositoryCommitSha,
    toolVersion: "eos-v3",
    overallAuthenticity,
    sourceChangeReason,
    results
};

fs.writeFileSync(path.join(runDir, 'validation-result.json'), JSON.stringify(validationResult, null, 2));

console.log(JSON.stringify(validationResult, null, 2));

// Do not exit with 1 if authenticity is valid but stage failed! Only exit 1 if authenticity is INVALID.
if (overallAuthenticity === "INVALID") {
    process.exit(1);
}
