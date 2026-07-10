import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { EOSv4Event } from './event-logger';

export function verifyEventLog(executionId: string): string {
    const runDir = path.resolve(__dirname, '../../.eos/runs', executionId);
    const logPath = path.join(runDir, 'event.log');
    
    if (!fs.existsSync(logPath)) {
        return 'EVENT_LOG_MISSING';
    }
    
    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
    let previousHash = "";
    let expectedSequence = 1;
    
    for (const line of lines) {
        if (!line) continue;
        const event = JSON.parse(line) as EOSv4Event;
        
        if (event.sequence !== expectedSequence) {
            return event.sequence < expectedSequence ? 'EVENT_SEQUENCE_DUPLICATE' : 'EVENT_SEQUENCE_MISSING';
        }
        
        if (event.previousEventHash !== previousHash) {
            return 'EVENT_CHAIN_BROKEN';
        }
        
        const eventWithoutHash = { ...event };
        delete (eventWithoutHash as any).eventHash;
        const calcHash = crypto.createHash('sha256').update(JSON.stringify(eventWithoutHash)).digest('hex');
        
        if (event.eventHash !== calcHash) {
            return 'EVENT_HASH_MISMATCH';
        }
        
        // Verify attachments
        for (const [relPath, expectedDigest] of Object.entries(event.attachmentDigests)) {
            const absPath = path.join(runDir, relPath);
            if (!fs.existsSync(absPath)) {
                return 'ATTACHMENT_MISSING';
            }
            const actualDigest = crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
            if (actualDigest !== expectedDigest) {
                return 'ATTACHMENT_TAMPERED';
            }
        }
        
        previousHash = event.eventHash;
        expectedSequence++;
    }
    
    return 'VALID';
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const execIdArg = args.find(a => a.startsWith('--execution-id='));
    if (!execIdArg) {
        console.error("Usage: tsx verify-event-log.ts --execution-id=<ID>");
        process.exit(1);
    }
    const execId = execIdArg.split('=')[1];
    const res = verifyEventLog(execId);
    console.log(res);
    if (res !== 'VALID') process.exit(1);
}
