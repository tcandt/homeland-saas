import * as fs from 'fs';
import * as path from 'path';

export interface Task {
    taskId: string;
    title: string;
    type?: string;
    dependencies: string[];
    allowedScope: string[];
    forbiddenScope: string[];
    requiredInputs?: string[];
    requiredOutputs?: string[];
    requiredCommands?: string[];
    requiredTests?: string[];
    exitCriteria?: string[];
    commitPolicy: 'REQUIRED' | 'OPTIONAL' | 'FORBIDDEN';
    riskLevel?: string;
    retryPolicy?: any;
    stopConditions?: string[];
    status: 'PENDING' | 'READY' | 'RUNNING' | 'BLOCKED' | 'FAILED' | 'VERIFIED' | 'SKIPPED_BY_POLICY';
}

export interface TaskGraph {
    schemaVersion: string;
    graphId: string;
    graphRevision: number;
    supersedesGraphId: string | null;
    generatedAtUtc: string;
    generatedBy: string;
    sourceGateHashes?: Record<string, string>;
    sourcePolicyHashes?: Record<string, string>;
    targetEpic: string;
    status: string;
    tasks: Task[];
}

export function validateTaskGraph(graph: TaskGraph): string {
    const taskMap = new Map<string, Task>();
    const seenIds = new Set<string>();
    
    // Check duplicates and self dependencies
    for (const t of graph.tasks) {
        if (seenIds.has(t.taskId)) {
            return 'DUPLICATE_TASK_ID';
        }
        seenIds.add(t.taskId);
        taskMap.set(t.taskId, t);
        
        if (t.dependencies.includes(t.taskId)) {
            return 'SELF_DEPENDENCY_DETECTED';
        }
    }
    
    // Check unknown dependencies and cycle detection
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycle = (taskId: string): boolean => {
        if (recursionStack.has(taskId)) return true;
        if (visited.has(taskId)) return false;
        
        visited.add(taskId);
        recursionStack.add(taskId);
        
        const t = taskMap.get(taskId);
        if (!t) return false; // Handled separately
        
        for (const dep of t.dependencies) {
            if (hasCycle(dep)) return true;
        }
        
        recursionStack.delete(taskId);
        return false;
    };
    
    for (const t of graph.tasks) {
        for (const dep of t.dependencies) {
            if (!taskMap.has(dep)) {
                return 'UNKNOWN_TASK_DEPENDENCY';
            }
        }
        
        if (hasCycle(t.taskId)) {
            return 'TASK_CYCLE_DETECTED';
        }
    }
    
    // Validate READY tasks do not have unverified/unskipped upstream dependencies
    for (const t of graph.tasks) {
        if (t.status === 'READY') {
            for (const depId of t.dependencies) {
                const dep = taskMap.get(depId)!;
                if (dep.status !== 'VERIFIED' && dep.status !== 'SKIPPED_BY_POLICY') {
                    return 'READY_TASK_HAS_UNVERIFIED_UPSTREAM';
                }
            }
        }
    }
    
    return 'VALID';
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const graphPathArg = args.find(a => a.startsWith('--graph='));
    if (!graphPathArg) {
        console.error("Usage: tsx validate-task-graph.ts --graph=<path>");
        process.exit(1);
    }
    const graphPath = graphPathArg.split('=')[1];
    if (!fs.existsSync(graphPath)) {
        console.error("Graph file not found.");
        process.exit(1);
    }
    const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8')) as TaskGraph;
    const res = validateTaskGraph(graph);
    console.log(res);
    if (res !== 'VALID') process.exit(1);
}
