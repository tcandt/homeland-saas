import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { ErrorCodes } from './error-codes';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly cls: ClsService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCodes.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details = null;

    if (exception instanceof ZodValidationException) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCodes.VALIDATION_ERROR;
      message = 'Validation failed';
      details = exception.getZodError().errors;
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCodes.VALIDATION_ERROR;
      message = 'Validation failed';
      details = exception.errors;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;
      message = typeof res === 'string' ? res : res.message || message;
      code = res.code || (status === 401 ? ErrorCodes.AUTH_INVALID_CREDENTIALS : 
             status === 403 ? ErrorCodes.PERMISSION_DENIED : code);
    } else if (exception && (exception as any).code === 'P2002') {
      status = HttpStatus.CONFLICT;
      code = 'RESOURCE_ALREADY_EXISTS';
      const target = (exception as any).meta?.target as string[] | string | undefined;
      const targetStr = Array.isArray(target) ? target.join(', ') : target;
      message = targetStr 
        ? `Dữ liệu đã tồn tại trong hệ thống (trùng trường: ${targetStr}). Vui lòng nhập giá trị khác.`
        : 'Dữ liệu đã tồn tại trong hệ thống. Vui lòng kiểm tra lại.';
    } else if (exception instanceof Error) {
      if (process.env.NODE_ENV !== 'production') {
        message = exception.message;
      }
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      const error = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(
        `${request.method} ${request.url} failed (requestId=${this.cls.getId() || 'unknown'}): ${error.message}`,
        error.stack,
      );
    }

    response.status(status).json({
      success: false,
      requestId: this.cls.getId(),
      timestamp: new Date().toISOString(),
      error: {
        code,
        message,
        details,
        path: request.url,
      },
    });
  }
}
