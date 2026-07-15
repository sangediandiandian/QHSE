/** @jest-environment node */

import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { TracingService } from './tracing.service';

describe('TracingService', () => {
  test.each([
    'ftp://collector.example/v1/traces',
    'https://user:secret@collector.example/v1/traces',
  ])('拒绝不安全 OTLP 端点: %s', (endpoint) => {
    const previous = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = endpoint;
    expect(() => TracingService.fromEnvironment()).toThrow(
      'OTLP trace endpoint must be an HTTP(S) URL without embedded credentials',
    );
    if (previous === undefined) delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    else process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = previous;
  });

  test('创建真实服务端 span 并继承远程父上下文', async () => {
    const exporter = new InMemorySpanExporter();
    const provider = new NodeTracerProvider({
      resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'qhse-api-test' }),
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    const service = new TracingService(provider, 'otlp-http');
    const handle = service.startHttpSpan('GET', '/api/v1/risks/123', {
      traceId: '1234567890abcdef1234567890abcdef',
      parentSpanId: 'fedcba0987654321',
      traceFlags: '01',
      traceState: 'vendor=value',
    });

    expect(handle.span.spanContext()).toMatchObject({
      traceId: '1234567890abcdef1234567890abcdef',
      traceFlags: 1,
    });
    expect(handle.span.spanContext().spanId).not.toBe('fedcba0987654321');
    expect(handle.span.spanContext().traceState?.serialize()).toBe('vendor=value');

    service.endHttpSpan(handle, '/api/v1/risks/:id', 503);
    await provider.forceFlush();
    const span = exporter.getFinishedSpans()[0];
    expect(span).toMatchObject({
      name: 'GET /api/v1/risks/:id',
      kind: SpanKind.SERVER,
      parentSpanContext: expect.objectContaining({ spanId: 'fedcba0987654321', isRemote: true }),
      status: { code: SpanStatusCode.ERROR },
      attributes: expect.objectContaining({
        'http.request.method': 'GET',
        'http.route': '/api/v1/risks/:id',
        'http.response.status_code': 503,
      }),
    });
    expect(service.snapshot()).toMatchObject({
      exporter: 'otlp-http',
      spansStarted: 1,
      spansEnded: 1,
    });
    await provider.shutdown();
  });
});
