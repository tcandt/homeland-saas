import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';
import { RequestAnomalyTrackerService } from './request-anomaly-tracker.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly requestAnomalyTracker: RequestAnomalyTrackerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          const duration = Date.now() - start;
          this.metricsService.recordRequest(
            req.method,
            req.url,
            res.statusCode,
            duration,
          );
          this.requestAnomalyTracker.recordRequest(extractRequestIp(req), req.url);
        },
        error: (err) => {
          const duration = Date.now() - start;
          const statusCode = err?.status || err?.statusCode || 500;
          this.metricsService.recordRequest(
            req.method,
            req.url,
            statusCode,
            duration,
          );
          this.requestAnomalyTracker.recordRequest(extractRequestIp(req), req.url);
        },
      }),
    );
  }
}

function extractRequestIp(req: any) {
  return (
    req?.headers?.['cf-connecting-ip'] ||
    req?.headers?.['x-forwarded-for'] ||
    req?.ip ||
    req?.socket?.remoteAddress ||
    null
  );
}
