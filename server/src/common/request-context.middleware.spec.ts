/** @jest-environment node */

import type { NextFunction, Response } from 'express';
import { RequestContextMiddleware, type RequestWithId } from './request-context.middleware';

describe('RequestContextMiddleware', () => {
  test('沿用有效上游 traceId 并创建新的服务端 span', () => {
    const headers = new Map<string, string>();
    const request = {
      header: (name: string) =>
        name === 'traceparent'
          ? '00-1234567890abcdef1234567890abcdef-fedcba0987654321-00'
          : undefined,
    } as unknown as RequestWithId;
    const response = {
      setHeader: (name: string, value: string) => headers.set(name, value),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    new RequestContextMiddleware().use(request, response, next);

    expect(request.traceId).toBe('1234567890abcdef1234567890abcdef');
    expect(request.parentSpanId).toBe('fedcba0987654321');
    expect(request.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(request.spanId).not.toMatch(/^0+$/);
    expect(request.spanId).not.toBe(request.parentSpanId);
    expect(request.traceFlags).toBe('00');
    expect(headers.get('traceparent')).toBe(`00-${request.traceId}-${request.spanId}-00`);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test.each([
    '00-00000000000000000000000000000000-fedcba0987654321-01',
    '00-1234567890abcdef1234567890abcdef-0000000000000000-01',
    'ff-1234567890abcdef1234567890abcdef-fedcba0987654321-01',
    'invalid',
  ])('无效 traceparent 生成新的根追踪上下文: %s', (traceparent) => {
    const request = {
      header: (name: string) => (name === 'traceparent' ? traceparent : undefined),
    } as unknown as RequestWithId;
    const response = { setHeader: jest.fn() } as unknown as Response;

    new RequestContextMiddleware().use(request, response, jest.fn());

    expect(request.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(request.traceId).not.toMatch(/^0+$/);
    expect(request.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(request.parentSpanId).toBeUndefined();
    expect(request.traceFlags).toBe('01');
  });
});
