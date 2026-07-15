import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { AuthPrincipal } from '../modules/iam/iam.types';
import { TracingService, type HttpTraceHandle } from '../infrastructure/tracing/tracing.service';
import { normalizeRoutePath } from './route-path';

const TRACEPARENT_PATTERN = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i;

function parseTraceparent(value?: string, traceState?: string) {
  const match = value?.match(TRACEPARENT_PATTERN);
  if (!match || /^0+$/.test(match[1]) || /^0+$/.test(match[2])) {
    return undefined;
  }
  return {
    traceId: match[1].toLowerCase(),
    parentSpanId: match[2].toLowerCase(),
    traceFlags: match[3].toLowerCase(),
    traceState,
  };
}

export interface RequestWithId extends Request {
  requestId: string;
  traceId: string;
  spanId: string;
  traceFlags: string;
  parentSpanId?: string;
  traceState?: string;
  traceHandle: HttpTraceHandle;
  accessToken?: string;
  principal?: AuthPrincipal;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly tracing: TracingService) {}

  use(req: RequestWithId, res: Response, next: NextFunction) {
    const candidate = req.header('x-request-id');
    const parent = parseTraceparent(req.header('traceparent'), req.header('tracestate'));
    const route = normalizeRoutePath(req.path);
    const handle = this.tracing.startHttpSpan(req.method, route, parent);
    const spanContext = handle.span.spanContext();
    req.requestId = candidate && /^[a-zA-Z0-9-]{1,64}$/.test(candidate) ? candidate : randomUUID();
    req.traceId = spanContext.traceId;
    req.spanId = spanContext.spanId;
    req.traceFlags = spanContext.traceFlags.toString(16).padStart(2, '0');
    req.parentSpanId = parent?.parentSpanId;
    req.traceState = spanContext.traceState?.serialize();
    req.traceHandle = handle;
    res.setHeader('x-request-id', req.requestId);
    res.setHeader('traceparent', `00-${req.traceId}-${req.spanId}-${req.traceFlags}`);
    if (req.traceState) res.setHeader('tracestate', req.traceState);
    let ended = false;
    const endSpan = () => {
      if (ended) return;
      ended = true;
      this.tracing.endHttpSpan(
        handle,
        req.route?.path || normalizeRoutePath(req.path),
        res.statusCode,
      );
    };
    res.once('finish', endSpan);
    res.once('close', endSpan);
    this.tracing.runWithSpan(handle, next);
  }
}
