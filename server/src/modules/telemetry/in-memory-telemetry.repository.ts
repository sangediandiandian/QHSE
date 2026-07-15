import { telemetryPointSeed } from './telemetry.seed';
import type { TelemetryPointQuery, TelemetryRepository } from './telemetry.repository';
import type { TelemetryPoint, TelemetrySample } from './telemetry.types';
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export class InMemoryTelemetryRepository implements TelemetryRepository {
  private points = new Map(telemetryPointSeed.map((item) => [item.id, clone(item)]));
  private samples = new Map<string, TelemetrySample>();
  async listPoints(query: TelemetryPointQuery) {
    return [...this.points.values()]
      .filter(
        (item) =>
          (!query.source || item.source === query.source) &&
          (!query.areaId || item.areaId === query.areaId) &&
          (!query.status || item.status === query.status) &&
          (!query.areaIds || query.areaIds.includes(item.areaId)),
      )
      .map(clone);
  }
  async findPoint(id: string) {
    const item = this.points.get(id);
    return item ? clone(item) : undefined;
  }
  async listSamples(pointId: string, limit: number) {
    return [...this.samples.values()]
      .filter((item) => item.pointId === pointId)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, limit)
      .map(clone);
  }
  async ingest(point: TelemetryPoint, sample: TelemetrySample) {
    const existing = this.samples.get(sample.id);
    if (existing)
      return { point: clone(this.points.get(point.id)!), sample: clone(existing), created: false };
    this.points.set(point.id, clone(point));
    this.samples.set(sample.id, clone(sample));
    return { point: clone(point), sample: clone(sample), created: true };
  }
}
