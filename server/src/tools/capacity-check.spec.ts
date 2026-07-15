/** @jest-environment node */

import {
  capacityConfigFromEnvironment,
  runCapacityCheck,
  summarizeDurations,
} from './capacity-check';

const config = {
  url: 'http://127.0.0.1:3001/api/health/live',
  requests: 3,
  concurrency: 1,
  timeoutMs: 100,
  maxP95Ms: 1_000,
  maxErrorRatePercent: 70,
};

describe('capacity check', () => {
  test('使用最近秩算法计算延迟分位数', () => {
    expect(summarizeDurations([40, 10, 30, 20])).toEqual({ p50: 20, p95: 40, p99: 40, max: 40 });
  });

  test('区分 HTTP 错误与网络错误并执行阈值判断', async () => {
    let calls = 0;
    const fetchImpl = jest.fn(async () => {
      calls += 1;
      if (calls === 1) return new Response('ok', { status: 200 });
      if (calls === 2) return new Response('unavailable', { status: 503 });
      throw new Error('connection refused');
    }) as unknown as typeof fetch;

    const report = await runCapacityCheck(config, fetchImpl);

    expect(report).toMatchObject({
      target: 'http://127.0.0.1:3001/api/health/live',
      requests: 3,
      successes: 1,
      errors: 2,
      networkErrors: 1,
      errorRatePercent: 66.67,
      statuses: { 200: 1, 503: 1 },
      passed: true,
    });
  });

  test('超时计入网络错误并使严格阈值失败', async () => {
    const fetchImpl = jest.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    ) as unknown as typeof fetch;
    const report = await runCapacityCheck(
      { ...config, requests: 1, timeoutMs: 50, maxErrorRatePercent: 0 },
      fetchImpl,
    );
    expect(report).toMatchObject({
      errors: 1,
      networkErrors: 1,
      errorRatePercent: 100,
      passed: false,
    });
  });

  test.each([
    { QHSE_CAPACITY_URL: 'ftp://example.com/check' },
    { QHSE_CAPACITY_URL: 'https://user:secret@example.com/check' },
    { QHSE_CAPACITY_CONCURRENCY: '501' },
  ])('拒绝不安全或越界配置: %j', (environment) => {
    expect(() => capacityConfigFromEnvironment(environment)).toThrow();
  });
});
