import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

console.log("Running Evidence Tamper Resistance Tests...");

const execCmd = (cmd: string) => {
    try {
        return execSync(cmd, { stdio: 'pipe' }).toString();
    } catch (e: any) {
        return e.stdout?.toString() + e.stderr?.toString();
    }
};

const runDir = path.resolve(__dirname, '../../docs/evidence/runs');
if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true });

// Setup a fake execution
const execId = "RUN-TEST-000";
const execPath = path.join(runDir, execId);
if (fs.existsSync(execPath)) fs.rmSync(execPath, { recursive: true, force: true });
fs.mkdirSync(execPath);

fs.writeFileSync(path.join(execPath, 'execution-manifest.json'), JSON.stringify({
    executionId: execId,
    epicId: '04'
}));

const stagePath = path.join(execPath, 'verify_prod-attempt-2');
fs.mkdirSync(stagePath);

const writeEvidence = (stdoutStr: string, exitCode: number) => {
    fs.writeFileSync(path.join(stagePath, 'stdout.log'), stdoutStr);
    fs.writeFileSync(path.join(stagePath, 'stderr.log'), '');
    const stdoutSha = execCmd(`node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('${path.join(stagePath, 'stdout.log').replace(/\\/g, '\\\\')}')).digest('hex'))"`).trim();
    const stderrSha = execCmd(`node -e "console.log(require('crypto').createHash('sha256').update('').digest('hex'))"`).trim();
    
    fs.writeFileSync(path.join(stagePath, 'evidence.json'), JSON.stringify({
        exitCode,
        finishedAtUtc: new Date().toISOString(),
        stdoutSha256: stdoutSha,
        stderrSha256: stderrSha
    }));
};

const validate = () => {
    const out = execCmd(`npx tsx scripts/eos/validate-evidence.ts --execution-id=${execId} --epic=04`);
    try {
        const json = JSON.parse(out);
        return json.results.verify_prod;
    } catch {
        return { valid: false, reason: "PARSE_ERROR", out };
    }
};

const expectReject = (name: string, reasonPart: string) => {
    const res = validate();
    if (res.valid === false && res.reason.includes(reasonPart)) {
        console.log(`[PASS] ${name} -> Rejected (${res.reason})`);
    } else {
        console.error(`[FAIL] ${name} -> Expected rejection containing ${reasonPart}, got:`, res);
    }
}

// Test A: Manually create PASS file - Rejected by STDOUT_HASH_MISMATCH if not hashed correctly, or MISSING_PASS_MARKER if just "PASS".
// Wait, if we write it via writeEvidence, it hashes correctly. So we test MISSING_PASS_MARKER.
writeEvidence("PASS", 0);
expectReject("Test A: Simple PASS", "MISSING_PASS_MARKER");

// Test B: Modify stdout after record generation
writeEvidence("Verification PASSED.", 0);
fs.writeFileSync(path.join(stagePath, 'stdout.log'), "Verification PASSED. Hacked");
expectReject("Test B: Tampered stdout", "STDOUT_HASH_MISMATCH");

// Test E: ExitCode 0 but missing "Verification PASSED."
writeEvidence("Some other output.", 0);
expectReject("Test E: Missing marker", "MISSING_PASS_MARKER");

// Test F: Contains "Verification PASSED." but ExitCode 1.
writeEvidence("Verification PASSED.", 1);
expectReject("Test F: Non-zero exit code", "NON_ZERO_EXIT");

// Test G: Contains PASS marker followed by P1001
writeEvidence("Verification PASSED.\nError: P1001", 0);
expectReject("Test G: Fail marker after pass", "FAIL_MARKER_AFTER_PASS");

// Test I: Valid real successful command.
writeEvidence("Some logs...\nVerification PASSED.\nDone.", 0);
const res = validate();
if (res.valid) {
    console.log(`[PASS] Test I: Valid evidence accepted.`);
} else {
    console.error(`[FAIL] Test I: Expected valid, got:`, res);
}

console.log("Tests complete.");
