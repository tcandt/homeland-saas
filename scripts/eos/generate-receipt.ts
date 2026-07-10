import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import minimist from 'minimist';
import * as yaml from 'yaml';

const args = minimist(process.argv.slice(2));
let epicInput = args.epic;

if (!epicInput) {
    console.error("Please provide an --epic flag, e.g., --epic=04");
    process.exit(1);
}
epicInput = String(epicInput).padStart(2, '0');

// Convert "04" to "04_INVOICE" if we can, or just look up directories.
const evidenceDirBase = path.resolve(__dirname, '../../docs/evidence');
const dirs = fs.readdirSync(evidenceDirBase).filter(d => fs.statSync(path.join(evidenceDirBase, d)).isDirectory());
const epicDirName = dirs.find(d => d.startsWith(epicInput));

if (!epicDirName) {
    console.error(`Could not find evidence directory starting with ${epicInput} in ${evidenceDirBase}`);
    process.exit(1);
}

const epicEvidencePath = path.join(evidenceDirBase, epicDirName);
const evidenceFiles = fs.readdirSync(epicEvidencePath).filter(f => f.endsWith('.txt'));

const getEvidenceStatus = (filename: string): string => {
    const fp = path.join(epicEvidencePath, filename);
    if (!fs.existsSync(fp)) return 'MISSING';
    return fs.readFileSync(fp, 'utf-8').replace(/[\0\uFFFD\uFEFF]/g, '').replace(/[^\x20-\x7E]/g, '').trim();
};

const evidence = {
    implementation: getEvidenceStatus('implementation.txt'),
    unit_test: getEvidenceStatus('unit_test.txt'),
    integration_test: getEvidenceStatus('integration_test.txt'),
    frontend_build: getEvidenceStatus('frontend_build.txt'),
    backend_build: getEvidenceStatus('backend_build.txt'),
    verify_prod: getEvidenceStatus('verify_prod.txt'),
    infrastructure: getEvidenceStatus('infrastructure.txt')
};

const isBlocked = evidence.infrastructure === 'BLOCKED' || evidence.verify_prod !== 'PASS';
const status = isBlocked ? 'VERIFICATION_BLOCKED' : 'PASS';

const gateObj = {
    epic: epicDirName,
    ...evidence,
    evidence: evidenceFiles.length > 0 ? (isBlocked ? 'INCOMPLETE' : 'COMPLETE') : 'MISSING',
    status: status
};

const gateYaml = yaml.stringify(gateObj);
const gatePath = path.resolve(__dirname, `../../docs/gates/EPIC_${epicInput}_GATE.yaml`);
fs.writeFileSync(gatePath, gateYaml);

const hash = crypto.createHash('sha256').update(gateYaml).digest('hex');

const receipt = `=== EXECUTION RECEIPT ===
Receipt ID: REC-${new Date().toISOString().replace(/\D/g,'').slice(0,14)}
Hash: SHA256:${hash}
Epic: ${epicDirName}
Implementation: ${gateObj.implementation}
Backend Build: ${gateObj.backend_build}
Frontend Build: ${gateObj.frontend_build}
Unit Test: ${gateObj.unit_test}
Integration: ${gateObj.integration_test}
verify:prod: ${gateObj.verify_prod}
Evidence: ${gateObj.evidence}
Infrastructure: ${gateObj.infrastructure}
---
Final Status: ${gateObj.status}
Epic Closed: ${gateObj.status === 'PASS' ? 'YES' : 'NO'}
Next Action: ${gateObj.status === 'PASS' ? 'Proceed to next Epic' : 'Operator restores Docker/Postgres then reruns verify:prod'}
=========================`;

console.log(receipt);
