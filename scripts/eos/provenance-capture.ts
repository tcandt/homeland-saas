import * as os from 'os';
import * as child_process from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export function captureSupplyChainAndRuntime(): any {
    const getHash = (p: string) => {
        try {
            return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
        } catch {
            return null;
        }
    };
    
    const resolveBin = (cmd: string) => {
        try {
            return child_process.execSync(`where ${cmd}`, { encoding: 'utf8' }).split('\n')[0].trim();
        } catch {
            return null;
        }
    };
    
    const getVersion = (cmd: string) => {
        try {
            return child_process.execSync(`${cmd} --version`, { encoding: 'utf8' }).trim();
        } catch {
            return null;
        }
    };

    const tools = ['node', 'npm', 'git', 'powershell'];
    const supplyChain: any = {};
    for (const t of tools) {
        const p = resolveBin(t);
        if (p) {
            const stat = fs.statSync(p);
            supplyChain[t] = {
                resolvedPath: p,
                realPath: fs.realpathSync(p),
                sha256: getHash(p),
                version: getVersion(t),
                fileSize: stat.size,
                lastWriteTimeUtc: stat.mtime.toISOString()
            };
        }
    }
    
    const eosTools = [
        'event-logger.ts', 'generate-attestation.ts', 'generate-gate.ts', 'generate-receipt.ts',
        'policy-engine.ts', 'test-planner.ts', 'validate-evidence.ts',
        'verify-attestation.ts', 'verify-event-log.ts', 'verify-pipeline.ts', 'provenance-capture.ts'
    ];
    
    for (const t of eosTools) {
        const p = path.resolve(__dirname, t);
        if (fs.existsSync(p)) {
            const stat = fs.statSync(p);
            supplyChain[t] = {
                resolvedPath: p,
                realPath: fs.realpathSync(p),
                sha256: getHash(p),
                fileSize: stat.size,
                lastWriteTimeUtc: stat.mtime.toISOString()
            };
        }
    }

    const runtime = {
        osVersion: os.release(),
        architecture: os.arch(),
        nodeVersion: process.version,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: Intl.DateTimeFormat().resolvedOptions().locale,
        encoding: 'utf-8',
        cpuModel: os.cpus()[0]?.model,
        totalMemory: os.totalmem(),
        pid: process.pid,
        executionSeed: crypto.randomBytes(16).toString('hex')
    };

    return { supplyChain, runtime };
}
