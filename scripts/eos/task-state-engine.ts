import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import { TaskGraph, Task } from './validate-task-graph';

export function enforceExecutorBoundaries(graphPath: string, taskId: string): string {
    if (!fs.existsSync(graphPath)) {
        return 'GRAPH_MISSING';
    }
    
    const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8')) as TaskGraph;
    const task = graph.tasks.find(t => t.taskId === taskId);
    if (!task) {
        return 'TASK_NOT_FOUND';
    }
    
    if (task.status !== 'READY' && task.status !== 'RUNNING') {
        return 'TASK_NOT_READY';
    }
    
    // Check files modified in git compared to index/HEAD
    let modifiedFiles: string[] = [];
    try {
        const diffOut = child_process.execSync('git diff --name-only', { encoding: 'utf8' });
        const untrackedOut = child_process.execSync('git ls-files --others --exclude-standard', { encoding: 'utf8' });
        modifiedFiles = [...diffOut.split('\n'), ...untrackedOut.split('\n')]
            .map(f => f.trim())
            .filter(f => f.length > 0);
    } catch (e) {
        return 'GIT_ERROR';
    }
    
    for (const file of modifiedFiles) {
        // Validate allowed scope
        let isAllowed = false;
        for (const scope of task.allowedScope) {
            if (scope === '*' || file.startsWith(scope)) {
                isAllowed = true;
                break;
            }
        }
        if (!isAllowed) {
            return 'FORBIDDEN_SCOPE_BREACH';
        }
        
        // Validate forbidden scope
        for (const scope of task.forbiddenScope) {
            if (file.startsWith(scope)) {
                return 'FORBIDDEN_SCOPE_BREACH';
            }
        }
    }
    
    return 'VALID';
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const graphArg = args.find(a => a.startsWith('--graph='));
    const taskArg = args.find(a => a.startsWith('--task='));
    
    if (!graphArg || !taskArg) {
        console.error("Usage: tsx task-state-engine.ts --graph=<path> --task=<id>");
        process.exit(1);
    }
    
    const res = enforceExecutorBoundaries(graphArg.split('=')[1], taskArg.split('=')[1]);
    console.log(res);
    if (res !== 'VALID') process.exit(1);
}
