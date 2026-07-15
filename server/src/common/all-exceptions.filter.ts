import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithId } from './request-context.middleware';

interface ErrorPayload {
  code?: string;
  message?: string | string[];
  details?: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException
      ? exception.getResponse()
      : undefined;
    const payload: ErrorPayload = typeof exceptionResponse === 'object'
      ? exceptionResponse as ErrorPayload
      : { message: String(exceptionResponse || '') };

    if (!(exception instanceof HttpException)) {
      console.error(`[${request.requestId}]`, exception);
    }

    response.status(status).json({
      success: false,
      error: {
        code: payload.code || `HTTP_${status}`,
        message: payload.message || (status === 500 ? '服务内部错误' : exceptionResponse),
        details: payload.details,
      },
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
