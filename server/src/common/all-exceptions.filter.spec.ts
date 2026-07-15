/** @jest-environment node */

import type { ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { StructuredLoggerService } from '../infrastructure/logging/structured-logger.service';

describe('AllExceptionsFilter', () => {
  test('内部异常只返回通用消息且结构化日志不包含异常内容', () => {
    const lines: string[] = [];
    const logger = new StructuredLoggerService((line) => lines.push(line));
    const json = jest.fn();
    const response = { status: jest.fn(() => ({ json })) };
    const request = {
      requestId: 'request-error',
      traceId: '1234567890abcdef1234567890abcdef',
      spanId: '1234567890abcdef',
      method: 'POST',
      path: '/api/v1/hazards',
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;

    new AllExceptionsFilter(logger).catch(new Error('database password=secret'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'HTTP_500', message: '服务内部错误' }),
        requestId: 'request-error',
        traceId: '1234567890abcdef1234567890abcdef',
      }),
    );
    expect(JSON.parse(lines[0])).toMatchObject({
      level: 'error',
      event: 'http.request.internal_error',
      requestId: 'request-error',
      traceId: '1234567890abcdef1234567890abcdef',
      spanId: '1234567890abcdef',
      errorType: 'Error',
    });
    expect(lines[0]).not.toContain('secret');
    expect(lines[0]).not.toContain('password');
  });
});
