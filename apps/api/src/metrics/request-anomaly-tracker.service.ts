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
  private samples: RequestSample[] = [];
  private readonly windowMs = 60_000;
  private lastPruneAt = 0;

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

    const now = Date.now();
    if (now - this.lastPruneAt > 5000 || this.samples.length > 2000) {
      this.prune(now);
    }

    this.samples.push({
      timestamp: now,
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
    this.lastPruneAt = now;
    const cutoff = now - this.windowMs;
    const firstValidIdx = this.samples.findIndex((s) => s.timestamp >= cutoff);
    if (firstValidIdx > 0) {
      this.samples = this.samples.slice(firstValidIdx);
    } else if (firstValidIdx === -1) {
      this.samples = [];
    }
  }
}

function normalizeIp(value: string | null | undefined) {
  const raw = String(value || '').trim();
  if (!raw) return 'unknown';
  const first = raw.split(',')[0]?.trim() || raw;
  return first.replace(/^::ffff:/i, '') || 'unknown';
}
