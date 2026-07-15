import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithId } from './request-context.middleware';
import { normalizeRoutePath } from './route-path';
import { StructuredLoggerService } from '../infrastructure/logging/structured-logger.service';

interface ErrorPayload {
  code?: string;
  message?: string | string[];
  details?: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: StructuredLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const payload: ErrorPayload =
      typeof exceptionResponse === 'object'
        ? (exceptionResponse as ErrorPayload)
        : { message: String(exceptionResponse || '') };

    if (!(exception instanceof HttpException)) {
      this.logger.write('error', 'http.request.internal_error', {
        requestId: request.requestId,
        traceId: request.traceId,
        spanId: request.spanId,
        method: request.method,
        path: request.route?.path || normalizeRoutePath(request.path),
        errorType: exception instanceof Error ? exception.name : 'UnknownError',
      });
    }

    response.status(status).json({
      success: false,
      error: {
        code: payload.code || `HTTP_${status}`,
        message: payload.message || (status === 500 ? '服务内部错误' : exceptionResponse),
        details: payload.details,
      },
      requestId: request.requestId,
      traceId: request.traceId,
      timestamp: new Date().toISOString(),
    });
  }
}
