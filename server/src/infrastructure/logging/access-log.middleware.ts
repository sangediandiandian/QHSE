import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { normalizeRoutePath } from '../../common/route-path';
import type { RequestWithId } from '../../common/request-context.middleware';
import { StructuredLoggerService, type LogLevel } from './structured-logger.service';

@Injectable()
export class AccessLogMiddleware implements NestMiddleware {
  constructor(private readonly logger: StructuredLoggerService) {}

  use(request: RequestWithId, response: Response, next: NextFunction) {
    if (process.env.QHSE_ACCESS_LOG === 'false') {
      next();
      return;
    }
    const started = process.hrtime.bigint();
    response.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      const level: LogLevel =
        response.statusCode >= 500 ? 'error' : response.statusCode >= 400 ? 'warn' : 'info';
      this.logger.write(level, 'http.request.completed', {
        requestId: request.requestId,
        method: request.method,
        path: request.route?.path || normalizeRoutePath(request.path),
        status: response.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        userId: request.principal?.userId,
      });
    });
    next();
  }
}
