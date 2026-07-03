import { Injectable, Logger } from '@nestjs/common';

export interface JobPayload {
  tenantId: string;
  name: string;
  data: any;
  retryCount?: number;
}

@Injectable()
export class JobDispatcher {
  private readonly logger = new Logger(JobDispatcher.name);

  async dispatch(job: JobPayload) {
    this.logger.log(`Dispatching Job [${job.name}] for Tenant [${job.tenantId}]`);
    // Placeholder for BullMQ Queue.add()
    // For now, process immediately (or delay simulating queue)
    setImmediate(() => {
      this.handleJob(job);
    });
  }

  private async handleJob(job: JobPayload) {
    this.logger.debug(`Handling Job [${job.name}]`);
    // Pass to specific handlers
  }
}
