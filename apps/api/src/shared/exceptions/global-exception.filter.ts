import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { ErrorCodes } from './error-codes';
import { ZodValidationException } from 'nestjs-zod';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
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
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;
      message = typeof res === 'string' ? res : res.message || message;
      code = res.code || (status === 401 ? ErrorCodes.AUTH_INVALID_CREDENTIALS : 
             status === 403 ? ErrorCodes.PERMISSION_DENIED : code);
    } else if (exception instanceof Error) {
      message = exception.message;
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
