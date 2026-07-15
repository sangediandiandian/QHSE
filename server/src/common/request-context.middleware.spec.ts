/** @jest-environment node */

import { EventEmitter } from 'node:events';
import type { NextFunction, Response } from 'express';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { TracingService } from '../infrastructure/tracing/tracing.service';
import { RequestContextMiddleware, type RequestWithId } from './request-context.middleware';

describe('RequestContextMiddleware', () => {
  const provider = new NodeTracerProvider();
  const tracing = new TracingService(provider, 'disabled');
  const response = () => {
    const value = new EventEmitter() as Response & EventEmitter;
    value.statusCode = 200;
    value.setHeader = jest.fn();
    return value;
  };

  afterAll(async () => provider.shutdown());

  test('沿用有效上游 traceId 并创建新的服务端 span', () => {
    const headers = new Map<string, string>();
    const request = {
      method: 'GET',
      path: '/api/health/live',
      header: (name: string) =>
        name === 'traceparent'
          ? '00-1234567890abcdef1234567890abcdef-fedcba0987654321-00'
          : undefined,
    } as unknown as RequestWithId;
    const responseValue = response();
    responseValue.setHeader = (name: string, value: string | number | readonly string[]) => {
      headers.set(name, String(value));
      return responseValue;
    };
    const next = jest.fn() as NextFunction;

    new RequestContextMiddleware(tracing).use(request, responseValue, next);

    expect(request.traceId).toBe('1234567890abcdef1234567890abcdef');
    expect(request.parentSpanId).toBe('fedcba0987654321');
    expect(request.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(request.spanId).not.toMatch(/^0+$/);
    expect(request.spanId).not.toBe(request.parentSpanId);
    expect(request.traceFlags).toBe('00');
    expect(headers.get('traceparent')).toBe(`00-${request.traceId}-${request.spanId}-00`);
    expect(next).toHaveBeenCalledTimes(1);
    responseValue.emit('finish');
  });

  test.each([
    '00-00000000000000000000000000000000-fedcba0987654321-01',
    '00-1234567890abcdef1234567890abcdef-0000000000000000-01',
    'ff-1234567890abcdef1234567890abcdef-fedcba0987654321-01',
    'invalid',
  ])('无效 traceparent 生成新的根追踪上下文: %s', (traceparent) => {
    const request = {
      method: 'GET',
      path: '/api/health/live',
      header: (name: string) => (name === 'traceparent' ? traceparent : undefined),
    } as unknown as RequestWithId;
    const responseValue = response();

    new RequestContextMiddleware(tracing).use(request, responseValue, jest.fn());

    expect(request.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(request.traceId).not.toMatch(/^0+$/);
    expect(request.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(request.parentSpanId).toBeUndefined();
    expect(request.traceFlags).toBe('01');
    responseValue.emit('finish');
  });
});
