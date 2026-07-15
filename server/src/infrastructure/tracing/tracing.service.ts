import {
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  context,
  createTraceState,
  trace,
  type Context,
  type Span,
  type Tracer,
} from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_HTTP_ROUTE,
  ATTR_SERVICE_NAME,
} from '@opentelemetry/semantic-conventions';
import type { OnApplicationShutdown } from '@nestjs/common';

export interface ParentTraceContext {
  traceId: string;
  parentSpanId: string;
  traceFlags: string;
  traceState?: string;
}

export interface HttpTraceHandle {
  span: Span;
  context: Context;
  method: string;
}

export interface TracingSnapshot {
  exporter: 'disabled' | 'otlp-http';
  spansStarted: number;
  spansEnded: number;
  lastSpanEndedAt?: string;
}

function validateEndpoint(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('OTLP trace endpoint must be an HTTP(S) URL without embedded credentials');
  }
}

export class TracingService implements OnApplicationShutdown {
  private readonly tracer: Tracer;
  private spansStarted = 0;
  private spansEnded = 0;
  private lastSpanEndedAt?: string;

  constructor(
    private readonly provider: NodeTracerProvider,
    private readonly exporter: TracingSnapshot['exporter'],
  ) {
    this.tracer = provider.getTracer('qhse-api');
  }

  static fromEnvironment() {
    const endpoint =
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    if (endpoint) validateEndpoint(endpoint);
    const spanProcessors = endpoint ? [new BatchSpanProcessor(new OTLPTraceExporter())] : undefined;
    const provider = new NodeTracerProvider({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'qhse-api',
      }),
      spanProcessors,
    });
    provider.register();
    return new TracingService(provider, endpoint ? 'otlp-http' : 'disabled');
  }

  startHttpSpan(method: string, path: string, parent?: ParentTraceContext): HttpTraceHandle {
    const parentContext = parent
      ? trace.setSpanContext(ROOT_CONTEXT, {
          traceId: parent.traceId,
          spanId: parent.parentSpanId,
          traceFlags: Number.parseInt(parent.traceFlags, 16) & 1,
          traceState: parent.traceState ? createTraceState(parent.traceState) : undefined,
          isRemote: true,
        })
      : ROOT_CONTEXT;
    const span = this.tracer.startSpan(
      `${method} ${path}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          [ATTR_HTTP_REQUEST_METHOD]: method,
          [ATTR_HTTP_ROUTE]: path,
        },
      },
      parentContext,
    );
    this.spansStarted += 1;
    return { span, context: trace.setSpan(parentContext, span), method };
  }

  runWithSpan<T>(handle: HttpTraceHandle, callback: () => T): T {
    return context.with(handle.context, callback);
  }

  endHttpSpan(handle: HttpTraceHandle, route: string, status: number) {
    handle.span.updateName(`${handle.method} ${route}`);
    handle.span.setAttributes({
      [ATTR_HTTP_ROUTE]: route,
      [ATTR_HTTP_RESPONSE_STATUS_CODE]: status,
    });
    if (status >= 500) handle.span.setStatus({ code: SpanStatusCode.ERROR });
    handle.span.end();
    this.spansEnded += 1;
    this.lastSpanEndedAt = new Date().toISOString();
  }

  snapshot(): TracingSnapshot {
    return {
      exporter: this.exporter,
      spansStarted: this.spansStarted,
      spansEnded: this.spansEnded,
      lastSpanEndedAt: this.lastSpanEndedAt,
    };
  }

  async onApplicationShutdown() {
    await this.provider.shutdown();
  }
}
