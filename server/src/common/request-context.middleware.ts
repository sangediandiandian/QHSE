import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import type { AuthPrincipal } from '../modules/iam/iam.types';

const TRACEPARENT_PATTERN = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i;

function randomNonZeroHex(bytes: number): string {
  const value = randomBytes(bytes).toString('hex');
  return /^0+$/.test(value) ? randomNonZeroHex(bytes) : value;
}

function parseTraceparent(value?: string) {
  const match = value?.match(TRACEPARENT_PATTERN);
  if (!match || /^0+$/.test(match[1]) || /^0+$/.test(match[2])) {
    return undefined;
  }
  return {
    traceId: match[1].toLowerCase(),
    parentSpanId: match[2].toLowerCase(),
    traceFlags: match[3].toLowerCase(),
  };
}

export interface RequestWithId extends Request {
  requestId: string;
  traceId: string;
  spanId: string;
  traceFlags: string;
  parentSpanId?: string;
  accessToken?: string;
  principal?: AuthPrincipal;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction) {
    const candidate = req.header('x-request-id');
    const parent = parseTraceparent(req.header('traceparent'));
    req.requestId = candidate && /^[a-zA-Z0-9-]{1,64}$/.test(candidate) ? candidate : randomUUID();
    req.traceId = parent?.traceId || randomNonZeroHex(16);
    req.spanId = randomNonZeroHex(8);
    req.traceFlags = parent?.traceFlags || '01';
    req.parentSpanId = parent?.parentSpanId;
    res.setHeader('x-request-id', req.requestId);
    res.setHeader('traceparent', `00-${req.traceId}-${req.spanId}-${req.traceFlags}`);
    next();
  }
}
