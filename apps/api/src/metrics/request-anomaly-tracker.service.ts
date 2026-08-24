import { Injectable } from '@nestjs/common';

type RequestSample = {
  timestamp: number;
  ip: string;
};

export type RequestAnomalySnapshot = {
  windowSeconds: number;
  totalRequests: number;
  uniqueIps: number;
  topSource: string | null;
  topSourceRequests: number;
  requestsPerSecond: number;
};

@Injectable()
export class RequestAnomalyTrackerService {
  private readonly samples: RequestSample[] = [];
  private readonly windowMs = 60_000;

  recordRequest(ip: string | null | undefined, path: string) {
    const normalizedPath = String(path || '').toLowerCase();
    if (
      !normalizedPath ||
      normalizedPath.includes('/health') ||
      normalizedPath.includes('/metrics') ||
      normalizedPath.includes('/notifications/zalo/webhook/health')
    ) {
      return;
    }

    this.prune(Date.now());
    this.samples.push({
      timestamp: Date.now(),
      ip: normalizeIp(ip),
    });
  }

  getSnapshot(now = Date.now()): RequestAnomalySnapshot {
    this.prune(now);
    const counts = new Map<string, number>();
    for (const sample of this.samples) {
      counts.set(sample.ip, (counts.get(sample.ip) || 0) + 1);
    }

    let topSource: string | null = null;
    let topSourceRequests = 0;
    for (const [ip, count] of counts.entries()) {
      if (count > topSourceRequests) {
        topSource = ip;
        topSourceRequests = count;
      }
    }

    return {
      windowSeconds: this.windowMs / 1000,
      totalRequests: this.samples.length,
      uniqueIps: counts.size,
      topSource,
      topSourceRequests,
      requestsPerSecond: Number((this.samples.length / (this.windowMs / 1000)).toFixed(2)),
    };
  }

  private prune(now: number) {
    while (this.samples.length > 0 && now - this.samples[0].timestamp > this.windowMs) {
      this.samples.shift();
    }
  }
}

function normalizeIp(value: string | null | undefined) {
  const raw = String(value || '').trim();
  if (!raw) return 'unknown';
  const first = raw.split(',')[0]?.trim() || raw;
  return first.replace(/^::ffff:/i, '') || 'unknown';
}
