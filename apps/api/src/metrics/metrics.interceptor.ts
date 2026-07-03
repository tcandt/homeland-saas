import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

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
        },
      }),
    );
  }
}
