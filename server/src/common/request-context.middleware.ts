import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { AuthPrincipal } from '../modules/iam/iam.types';

export interface RequestWithId extends Request {
  requestId: string;
  accessToken?: string;
  principal?: AuthPrincipal;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction) {
    const candidate = req.header('x-request-id');
    req.requestId = candidate && /^[a-zA-Z0-9-]{1,64}$/.test(candidate) ? candidate : randomUUID();
    res.setHeader('x-request-id', req.requestId);
    next();
  }
}
