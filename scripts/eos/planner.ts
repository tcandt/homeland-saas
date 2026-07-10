import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as yaml from 'yaml';
import { TaskGraph, Task } from './validate-task-graph';

export function planExecution(epicId: string): TaskGraph {
    const gatesDir = path.resolve(__dirname, '../../docs/gates');
    const policiesDir = path.resolve(__dirname, '../../docs/gates/policies');
    const runsDir = path.resolve(__dirname, '../../.eos/runs');
    
    const policyPath = path.join(policiesDir, `EPIC_${epicId}_POLICY.yaml`);
    if (!fs.existsSync(policyPath)) {
        throw new Error(`Policy missing for epic ${epicId}`);
    }
    
    // Hash source gate and policy files for pinning
    const sourceGateHashes: Record<string, string> = {};
    const sourcePolicyHashes: Record<string, string> = {};
    
    if (fs.existsSync(gatesDir)) {
        fs.readdirSync(gatesDir).forEach(f => {
            if (f.endsWith('_GATE.yaml')) {
                const content = fs.readFileSync(path.join(gatesDir, f));
                sourceGateHashes[f] = crypto.createHash('sha256').update(content).digest('hex');
            }
        });
    }
    if (fs.existsSync(policiesDir)) {
        fs.readdirSync(policiesDir).forEach(f => {
            if (f.endsWith('_POLICY.yaml')) {
                const content = fs.readFileSync(path.join(policiesDir, f));
                sourcePolicyHashes[f] = crypto.createHash('sha256').update(content).digest('hex');
            }
        });
    }
    
    const tasks: Task[] = [];
    
    if (epicId === '04') {
        tasks.push({
            taskId: "T4_1",
            title: "Diagnose Prisma Migrate & Database Tables in Epic 04",
            status: "READY",
            dependencies: [],
            allowedScope: ["packages/database/prisma/"],
            forbiddenScope: ["apps/web/"],
            commitPolicy: "REQUIRED"
        });
        tasks.push({
            taskId: "T4_2",
            title: "Resolve Prisma connection blockers (P1001)",
            status: "PENDING",
            dependencies: ["T4_1"],
            allowedScope: ["*"],
            forbiddenScope: [],
            commitPolicy: "REQUIRED"
        });
        tasks.push({
            taskId: "T4_3",
            title: "Run local pipeline for Epic 04 to generate evidence",
            status: "PENDING",
            dependencies: ["T4_2"],
            allowedScope: ["*"],
            forbiddenScope: [],
            commitPolicy: "REQUIRED"
        });
    } else {
        tasks.push({
            taskId: "T_GENERIC",
            title: `Execute Epic ${epicId}`,
            status: "READY",
            dependencies: [],
            allowedScope: ["*"],
            forbiddenScope: [],
            commitPolicy: "REQUIRED"
        });
    }
    
    const graph: TaskGraph = {
        schemaVersion: "5.0",
        graphId: `G-${epicId}-${Date.now()}`,
        graphRevision: 1,
        supersedesGraphId: null,
        generatedAtUtc: new Date().toISOString(),
        generatedBy: "scripts/eos/planner.ts",
        sourceGateHashes,
        sourcePolicyHashes,
        targetEpic: epicId,
        status: "ACTIVE",
        tasks
    };
    
    return graph;
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const epicArg = args.find(a => a.startsWith('--epic='));
    if (!epicArg) {
        console.error("Usage: tsx planner.ts --epic=<EPIC_ID>");
        process.exit(1);
    }
    const epicId = epicArg.split('=')[1];
    const graph = planExecution(epicId);
    console.log(JSON.stringify(graph, null, 2));
}
