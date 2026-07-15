import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { RuntimeMetricsService } from './runtime-metrics.service';
import { normalizeRoutePath } from '../../common/route-path';

@Injectable()
export class RuntimeMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: RuntimeMetricsService) {}

  use(request: Request, response: Response, next: NextFunction) {
    const started = process.hrtime.bigint();
    response.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      this.metrics.record(
        request.method,
        request.route?.path || normalizeRoutePath(request.path),
        response.statusCode,
        Math.round(durationMs * 100) / 100,
      );
    });
    next();
  }
}
