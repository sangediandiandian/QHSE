import { Injectable } from '@nestjs/common';

interface RouteMetric {
  method: string;
  path: string;
  count: number;
  errorCount: number;
  durationTotalMs: number;
  durationMaxMs: number;
  lastStatus: number;
  lastSeenAt: string;
}

@Injectable()
export class RuntimeMetricsService {
  private readonly routes = new Map<string, RouteMetric>();
  private startedAt = new Date().toISOString();

  record(method: string, path: string, status: number, durationMs: number, now = new Date()) {
    const key = `${method} ${path}`;
    const current = this.routes.get(key) ?? {
      method,
      path,
      count: 0,
      errorCount: 0,
      durationTotalMs: 0,
      durationMaxMs: 0,
      lastStatus: status,
      lastSeenAt: now.toISOString(),
    };
    current.count += 1;
    if (status >= 400) current.errorCount += 1;
    current.durationTotalMs += durationMs;
    current.durationMaxMs = Math.max(current.durationMaxMs, durationMs);
    current.lastStatus = status;
    current.lastSeenAt = now.toISOString();
    this.routes.set(key, current);
  }

  snapshot() {
    const routes = [...this.routes.values()]
      .map((item) => ({
        ...item,
        averageDurationMs: item.count
          ? Math.round((item.durationTotalMs / item.count) * 100) / 100
          : 0,
        errorRate: item.count ? Math.round((item.errorCount / item.count) * 10_000) / 100 : 0,
      }))
      .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
    return {
      startedAt: this.startedAt,
      totalRequests: routes.reduce((sum, item) => sum + item.count, 0),
      totalErrors: routes.reduce((sum, item) => sum + item.errorCount, 0),
      routes,
    };
  }
}
