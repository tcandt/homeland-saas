import { Page, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// Global Prisma instance for test helpers
const prisma = new PrismaClient();

export class EvidenceCollector {
  private page: Page;
  private scenarioName: string;
  private logs: string[] = [];
  
  constructor(page: Page, scenarioName: string) {
    this.page = page;
    this.scenarioName = scenarioName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }

  /**
   * Starts collecting evidence: console logs.
   */
  async start() {
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.logs.push(`[ERROR] ${msg.text()}`);
      } else if (msg.type() === 'warning') {
        this.logs.push(`[WARN] ${msg.text()}`);
      } else {
        this.logs.push(`[LOG] ${msg.text()}`);
      }
    });
  }

  /**
   * Saves console logs and throws an error if any runtime console.error occurred.
   */
  async stopAndVerifyNoErrors() {
    const errorLogs = this.logs.filter(log => {
      if (!log.startsWith('[ERROR]')) return false;
      // Ignore known Next.js proxy limitations with SSE that trigger fallback
      if (log.includes('status of 503 (Service Unavailable)') && log.includes('stream')) return false;
      if (log.includes('SSE Error, falling back to polling')) return false;
      
      // Ignore Next.js RSC prefetch aborts caused by fast Playwright navigations
      if (log.includes('Failed to fetch RSC payload') && log.includes('TypeError: Failed to fetch')) return false;
      
      // Also catch generic 503 in case the URL isn't logged directly in the message
      if (log.includes('status of 503 (Service Unavailable)')) {
          // Verify if it's accompanied by the SSE fallback error right after
          const index = this.logs.indexOf(log);
          if (index + 1 < this.logs.length && this.logs[index + 1].includes('SSE Error')) return false;
      }
      return true;
    });
    
    // Save to artifact directory
    const testInfo = test.info();
    const artifactDir = testInfo.outputDir;
    
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }
    
    fs.writeFileSync(path.join(artifactDir, 'console.log'), this.logs.join('\n'));

    // The gate: Zero console errors allowed
    if (errorLogs.length > 0) {
      throw new Error(`Runtime Gate Failed: Found console errors during scenario execution.\n${errorLogs.join('\n')}`);
    }
  }

  /**
   * Takes a DB Snapshot for the specified entity
   */
  async captureDbSnapshot(name: string, query: () => Promise<any>) {
    const data = await query();
    const testInfo = test.info();
    const artifactDir = testInfo.outputDir;
    
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }
    
    fs.writeFileSync(path.join(artifactDir, `${name}.json`), JSON.stringify(data, null, 2));
    return data;
  }

  /**
   * Gets the shared Prisma client for DB validations
   */
  getPrisma() {
    return prisma;
  }
}
