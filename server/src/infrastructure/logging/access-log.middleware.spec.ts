/** @jest-environment node */

import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import type { RequestWithId } from '../../common/request-context.middleware';
import { AccessLogMiddleware } from './access-log.middleware';
import { StructuredLoggerService } from './structured-logger.service';

describe('AccessLogMiddleware', () => {
  test('输出路由模板、请求上下文和状态但不记录敏感字段', () => {
    const lines: string[] = [];
    const logger = new StructuredLoggerService(
      (line) => lines.push(line),
      () => new Date('2026-07-15T08:00:00Z'),
    );
    const middleware = new AccessLogMiddleware(logger);
    const request = {
      requestId: 'request-1',
      traceId: '1234567890abcdef1234567890abcdef',
      spanId: '1234567890abcdef',
      parentSpanId: 'fedcba0987654321',
      method: 'GET',
      path: '/api/v1/risks/123456',
      route: { path: '/api/v1/risks/:id' },
      principal: { userId: 'user-admin' },
      headers: { authorization: 'Bearer secret' },
      query: { password: 'secret' },
    } as unknown as RequestWithId;
    const response = new EventEmitter() as Response & EventEmitter;
    response.statusCode = 404;
    const next = jest.fn();
    middleware.use(request, response, next);
    response.emit('finish');

    expect(next).toHaveBeenCalledTimes(1);
    expect(JSON.parse(lines[0])).toMatchObject({
      timestamp: '2026-07-15T08:00:00.000Z',
      level: 'warn',
      event: 'http.request.completed',
      requestId: 'request-1',
      traceId: '1234567890abcdef1234567890abcdef',
      spanId: '1234567890abcdef',
      parentSpanId: 'fedcba0987654321',
      method: 'GET',
      path: '/api/v1/risks/:id',
      status: 404,
      userId: 'user-admin',
    });
    expect(lines[0]).not.toContain('secret');
    expect(lines[0]).not.toContain('password');
  });
});
