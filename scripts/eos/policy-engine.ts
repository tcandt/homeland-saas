import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as yaml from 'yaml';

export function evaluatePolicy(executionId: string, epicId: string): any {
    const runDir = path.resolve(__dirname, '../../.eos/runs', executionId);
    const receiptPath = path.join(runDir, 'receipt.json');
    const policyPath = path.resolve(__dirname, '../../docs/gates/policies', \EPIC_\_POLICY.yaml\);
    const gatesDir = path.resolve(__dirname, '../../docs/gates');
    
    if (!fs.existsSync(receiptPath)) {
        return { decision: 'REJECT', status: 'VERIFICATION_BLOCKED', reasons: ['RECEIPT_MISSING'] };
    }
    
    if (!fs.existsSync(policyPath)) {
        return { decision: 'REJECT', status: 'VERIFICATION_BLOCKED', reasons: ['POLICY_MISSING'] };
    }

    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    const policy = yaml.parse(fs.readFileSync(policyPath, 'utf8'));
    const reasons: string[] = [];

    // Phase 3: Dependency Graph
    if (policy.requiresDependencies) {
        for (const dep of policy.requiresDependencies) {
            if (dep === epicId) {
                reasons.push('DEPENDENCY_SELF_REFERENCE');
                continue;
            }
            const depGatePath = path.join(gatesDir, \EPIC_\_GATE.yaml\);
            if (!fs.existsSync(depGatePath)) {
                reasons.push('DEPENDENCY_UNKNOWN');
                continue;
            }
            const depGate = yaml.parse(fs.readFileSync(depGatePath, 'utf8'));
            if (depGate.status !== 'RELEASE_READY' && depGate.status !== 'LOCAL_VERIFIED' && depGate.status !== 'PRODUCTION_VERIFIED') {
                reasons.push('DEPENDENCY_STATUS_UNSATISFIED');
            }
        }
    }

    if (policy.requiresStages) {
        for (const stage of policy.requiresStages) {
            if (!receipt.attestation.stageResults[stage]) {
                reasons.push(\MISSING_STAGE_\\);
            }
        }
    }

    if (policy.trustProfile && receipt.attestation.trustProfile !== policy.trustProfile) {
        reasons.push('TRUST_PROFILE_MISMATCH');
    }

    let finalStatus = 'VERIFICATION_BLOCKED';
    let decision = 'REJECT';
    
    if (reasons.some(r => r.startsWith('DEPENDENCY'))) {
        finalStatus = 'BLOCKED_BY_DEPENDENCY';
    } else if (reasons.length === 0) {
        decision = 'PASS';
        if (receipt.attestation.trustProfile === 'LOCAL_DEVELOPMENT') {
            finalStatus = 'LOCAL_VERIFIED';
        } else if (receipt.attestation.trustProfile === 'CI_TRUSTED') {
            finalStatus = 'PRODUCTION_VERIFIED'; // Or RELEASE_READY based on allowedStatuses
        }
    }

    const evalResult = {
        schemaVersion: "4.0",
        executionId,
        epicId,
        policyHash: crypto.createHash('sha256').update(fs.readFileSync(policyPath)).digest('hex'),
        receiptHash: crypto.createHash('sha256').update(fs.readFileSync(receiptPath)).digest('hex'),
        decision,
        status: finalStatus,
        reasons,
        evaluatedAtUtc: new Date().toISOString()
    };
    
    fs.writeFileSync(path.join(runDir, 'policy-evaluation.json'), JSON.stringify(evalResult, null, 2));
    return evalResult;
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const execIdArg = args.find(a => a.startsWith('--execution-id='));
    const epicArg = args.find(a => a.startsWith('--epic='));
    
    if (!execIdArg || !epicArg) {
        console.error("Usage: tsx policy-engine.ts --execution-id=<ID> --epic=<EPIC>");
        process.exit(1);
    }
    
    const res = evaluatePolicy(execIdArg.split('=')[1], epicArg.split('=')[1]);
    console.log("Policy Evaluation Decision:", res.decision, "Status:", res.status);
    if (res.decision !== 'PASS') process.exit(1);
}
