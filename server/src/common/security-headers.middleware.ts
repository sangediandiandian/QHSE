import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('x-frame-options', 'DENY');
    response.setHeader('referrer-policy', 'no-referrer');
    response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    if (request.path.startsWith('/api/v1/auth') || request.path.startsWith('/api/login')) {
      response.setHeader('cache-control', 'no-store');
    }
    if (request.secure) response.setHeader('strict-transport-security', 'max-age=31536000');
    next();
  }
}
