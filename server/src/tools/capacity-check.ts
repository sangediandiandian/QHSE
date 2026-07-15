import { performance } from 'node:perf_hooks';

export interface CapacityCheckConfig {
  url: string;
  requests: number;
  concurrency: number;
  timeoutMs: number;
  maxP95Ms: number;
  maxErrorRatePercent: number;
  bearerToken?: string;
}

export interface CapacityCheckReport {
  target: string;
  requests: number;
  concurrency: number;
  totalDurationMs: number;
  throughputPerSecond: number;
  successes: number;
  errors: number;
  networkErrors: number;
  errorRatePercent: number;
  latencyMs: ReturnType<typeof summarizeDurations>;
  statuses: Record<string, number>;
  thresholds: {
    maxP95Ms: number;
    maxErrorRatePercent: number;
  };
  passed: boolean;
}

function boundedNumber(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  }
  return parsed;
}

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

export function summarizeDurations(values: number[]) {
  if (!values.length) return { p50: 0, p95: 0, p99: 0, max: 0 };
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (ratio: number) => sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
  return {
    p50: rounded(percentile(0.5)),
    p95: rounded(percentile(0.95)),
    p99: rounded(percentile(0.99)),
    max: rounded(sorted[sorted.length - 1]),
  };
}

export function capacityConfigFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): CapacityCheckConfig {
  const value = environment.QHSE_CAPACITY_URL || 'http://127.0.0.1:3001/api/health/live';
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('QHSE_CAPACITY_URL must be an HTTP(S) URL without embedded credentials');
  }
  return {
    url: value,
    requests: Math.floor(
      boundedNumber(environment.QHSE_CAPACITY_REQUESTS, 200, 1, 100_000, 'QHSE_CAPACITY_REQUESTS'),
    ),
    concurrency: Math.floor(
      boundedNumber(environment.QHSE_CAPACITY_CONCURRENCY, 20, 1, 500, 'QHSE_CAPACITY_CONCURRENCY'),
    ),
    timeoutMs: Math.floor(
      boundedNumber(
        environment.QHSE_CAPACITY_TIMEOUT_MS,
        5_000,
        50,
        60_000,
        'QHSE_CAPACITY_TIMEOUT_MS',
      ),
    ),
    maxP95Ms: boundedNumber(
      environment.QHSE_CAPACITY_MAX_P95_MS,
      500,
      1,
      60_000,
      'QHSE_CAPACITY_MAX_P95_MS',
    ),
    maxErrorRatePercent: boundedNumber(
      environment.QHSE_CAPACITY_MAX_ERROR_RATE,
      1,
      0,
      100,
      'QHSE_CAPACITY_MAX_ERROR_RATE',
    ),
    bearerToken: environment.QHSE_CAPACITY_BEARER_TOKEN,
  };
}

export async function runCapacityCheck(
  config: CapacityCheckConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<CapacityCheckReport> {
  const durations: number[] = [];
  const statuses: Record<string, number> = {};
  let cursor = 0;
  let errors = 0;
  let networkErrors = 0;
  const startedAt = performance.now();
  const worker = async () => {
    while (cursor < config.requests) {
      cursor += 1;
      const requestStartedAt = performance.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
      timeout.unref();
      try {
        const response = await fetchImpl(config.url, {
          headers: config.bearerToken
            ? { authorization: `Bearer ${config.bearerToken}` }
            : undefined,
          signal: controller.signal,
        });
        await response.arrayBuffer();
        const status = String(response.status);
        statuses[status] = (statuses[status] || 0) + 1;
        if (response.status < 200 || response.status >= 400) errors += 1;
      } catch {
        errors += 1;
        networkErrors += 1;
      } finally {
        clearTimeout(timeout);
        durations.push(performance.now() - requestStartedAt);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(config.concurrency, config.requests) }, () => worker()),
  );
  const totalDurationMs = performance.now() - startedAt;
  const latencyMs = summarizeDurations(durations);
  const errorRatePercent = rounded((errors / config.requests) * 100);
  return {
    target: new URL(config.url).origin + new URL(config.url).pathname,
    requests: config.requests,
    concurrency: config.concurrency,
    totalDurationMs: rounded(totalDurationMs),
    throughputPerSecond: rounded(config.requests / (totalDurationMs / 1_000)),
    successes: config.requests - errors,
    errors,
    networkErrors,
    errorRatePercent,
    latencyMs,
    statuses,
    thresholds: {
      maxP95Ms: config.maxP95Ms,
      maxErrorRatePercent: config.maxErrorRatePercent,
    },
    passed: latencyMs.p95 <= config.maxP95Ms && errorRatePercent <= config.maxErrorRatePercent,
  };
}

async function main() {
  const report = await runCapacityCheck(capacityConfigFromEnvironment());
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'capacity check failed'}\n`);
    process.exitCode = 1;
  });
}
