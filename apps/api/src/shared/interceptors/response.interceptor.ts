import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ClsService } from 'nestjs-cls';

export interface Response<T> {
  success: boolean;
  requestId?: string;
  timestamp: string;
  message: string;
  data: T;
  meta?: any;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T> | any> {
    const request = context.switchToHttp().getRequest();
    // Bypass interceptor for metrics endpoint
    if (request.url && (request.url.includes('/metrics') || request.url.includes('/settings/file'))) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // If data already has success/meta structure (e.g. from Pagination), keep it
        const isPaginated = data && data.meta && data.data;
        const payload = isPaginated ? data.data : data;
        const meta = isPaginated ? data.meta : undefined;
        const message = data?.message || 'Success';

        // Remove message from payload if it was explicitly returned
        if (payload && payload.message) {
          delete payload.message;
        }

        return {
          success: true,
          requestId: this.cls.getId(),
          timestamp: new Date().toISOString(),
          message,
          data: payload || null,
          meta,
        };
      }),
    );
  }
}
