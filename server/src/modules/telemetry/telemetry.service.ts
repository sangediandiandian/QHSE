import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { WarningExecutionService } from '../warning-execution/warning-execution.service';
import type { IngestTelemetrySampleDto } from './telemetry.dto';
import type { TelemetryPointQuery, TelemetryRepository } from './telemetry.repository';
import type { TelemetryPoint } from './telemetry.types';
export class TelemetryService {
  constructor(
    private readonly repo: TelemetryRepository,
    private readonly warnings: WarningExecutionService,
    private readonly now: () => Date = () => new Date(),
  ) {}
  listPoints(query: TelemetryPointQuery, allowedAreaIds?: string[]) {
    return this.repo.listPoints({ ...query, areaIds: allowedAreaIds });
  }
  async getPoint(id: string, allowedAreaIds?: string[]) {
    const point = await this.repo.findPoint(id);
    if (!point || (allowedAreaIds && !allowedAreaIds.includes(point.areaId))) this.notFound();
    return point;
  }
  async history(id: string, limit = 100, allowedAreaIds?: string[]) {
    await this.getPoint(id, allowedAreaIds);
    return this.repo.listSamples(id, limit);
  }
  async ingest(input: IngestTelemetrySampleDto, allowedAreaIds?: string[]) {
    const current = await this.getPoint(input.pointId, allowedAreaIds);
    if (current.source !== input.source)
      throw new BadRequestException({
        code: 'TELEMETRY_SOURCE_MISMATCH',
        message: '数据源与点位类型不匹配',
      });
    if (!(current.metricKey in input.metrics))
      throw new BadRequestException({
        code: 'TELEMETRY_PRIMARY_METRIC_REQUIRED',
        message: `缺少主指标 ${current.metricKey}`,
      });
    const occurredAt = new Date(input.occurredAt).toISOString();
    const now = this.now().toISOString();
    const point: TelemetryPoint = {
      ...current,
      currentMetrics: { ...current.currentMetrics, ...input.metrics },
      ...deriveState(current, input.metrics, input.quality),
      lastSampleAt: occurredAt,
      version: current.version + 1,
      updatedAt: now,
    };
    const result = await this.repo.ingest(point, {
      id: input.sampleId.trim(),
      pointId: current.id,
      source: current.source,
      occurredAt,
      metrics: input.metrics,
      quality: input.quality,
      createdAt: now,
    });
    const evaluation =
      result.created && input.quality !== 'bad'
        ? await this.warnings.evaluate({
            source: current.source,
            subjectId: current.id,
            areaId: current.areaId,
            occurredAt,
            metrics: input.metrics,
          })
        : undefined;
    return { ...result, evaluation };
  }
  private notFound(): never {
    throw new NotFoundException({ code: 'TELEMETRY_POINT_NOT_FOUND', message: '遥测点位不存在' });
  }
}
function deriveState(
  point: TelemetryPoint,
  metrics: Record<string, string | number | boolean>,
  quality: string,
) {
  if (quality === 'bad') return { status: 'offline', onlineStatus: 'fault' as const };
  const value = Number(metrics[point.metricKey]);
  const config = point.configuration;
  if (point.source === 'GDS')
    return {
      status:
        value >= Number(config.alarmLevel2)
          ? 'level2'
          : value >= Number(config.alarmLevel1)
            ? 'level1'
            : 'normal',
      onlineStatus: 'online' as const,
    };
  if (point.source === 'VOC') {
    const limit = Number(config.limitValue);
    return {
      status: value > limit ? 'exceeded' : value >= limit * 0.9 ? 'warning' : 'normal',
      onlineStatus: 'online' as const,
    };
  }
  const low = Number(config.lowerLimit);
  const high = Number(config.upperLimit);
  const margin = (high - low) * 0.05;
  return {
    status:
      value < low || value > high
        ? 'alarm'
        : value < low + margin || value > high - margin
          ? 'warning'
          : 'normal',
    onlineStatus: 'online' as const,
  };
}
