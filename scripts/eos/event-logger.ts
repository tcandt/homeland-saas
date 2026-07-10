import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface EOSv4Event {
    schemaVersion: string;
    executionId: string;
    sequence: number;
    timestampUtc: string;
    eventType: string;
    previousEventHash: string;
    payload: any;
    payloadHash: string;
    attachmentDigests: Record<string, string>;
    eventHash: string;
}

export class EventLogger {
    private runDir: string;
    private logPath: string;
    
    constructor(private executionId: string) {
        this.runDir = path.resolve(__dirname, '../../.eos/runs', executionId);
        if (!fs.existsSync(this.runDir)) fs.mkdirSync(this.runDir, { recursive: true });
        this.logPath = path.join(this.runDir, 'event.log');
    }

    public append(eventType: string, payload: any, attachments: string[] = []): EOSv4Event {
        let sequence = 1;
        let previousEventHash = "";
        
        if (fs.existsSync(this.logPath)) {
            const content = fs.readFileSync(this.logPath, 'utf8').trim().split('\n');
            const lastLine = content[content.length - 1];
            if (lastLine) {
                const lastEvent = JSON.parse(lastLine) as EOSv4Event;
                sequence = lastEvent.sequence + 1;
                previousEventHash = lastEvent.eventHash;
            }
        }
        
        const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
        
        const attachmentDigests: Record<string, string> = {};
        for (const relPath of attachments) {
            const absPath = path.join(this.runDir, relPath);
            if (fs.existsSync(absPath)) {
                attachmentDigests[relPath] = crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
            }
        }
        
        const event: EOSv4Event = {
            schemaVersion: "4.0",
            executionId: this.executionId,
            sequence,
            timestampUtc: new Date().toISOString(),
            eventType,
            previousEventHash,
            payload,
            payloadHash,
            attachmentDigests,
            eventHash: ""
        };
        
        // Calculate eventHash
        const eventWithoutHash = { ...event };
        delete (eventWithoutHash as any).eventHash;
        event.eventHash = crypto.createHash('sha256').update(JSON.stringify(eventWithoutHash)).digest('hex');
        
        // Append atomically
        fs.appendFileSync(this.logPath, JSON.stringify(event) + '\n', { flag: 'a' });
        
        return event;
    }
}
