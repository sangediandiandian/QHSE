import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { WarningExecutionService } from '../warning-execution/warning-execution.service';
import type { IngestTelemetrySampleDto } from './telemetry.dto';
import type { TelemetryPointQuery, TelemetryRepository } from './telemetry.repository';
import { TelemetryStreamService } from './telemetry-stream.service';
import type { TelemetryPoint } from './telemetry.types';

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

function toWarningMetrics(
  point: TelemetryPoint,
  metrics: Record<string, string | number | boolean>,
) {
  const primaryValue = metrics[point.metricKey];
  if (point.source === 'GDS') {
    const previousValue = Number(point.currentMetrics[point.metricKey]);
    const currentValue = Number(primaryValue);
    return {
      ...metrics,
      'GDS.currentValue': primaryValue,
      'GDS.trend':
        currentValue > previousValue ? 'up' : currentValue < previousValue ? 'down' : 'stable',
    };
  }
  if (point.source === 'VOC')
    return {
      ...metrics,
      'VOC.outletValue': primaryValue,
      limit: Number(point.configuration.limitValue),
    };
  const parameterType = String(point.configuration.parameterType ?? '').trim();
  return {
    ...metrics,
    'MES.value': primaryValue,
    ...(parameterType === '压力' ? { 'MES.pressure': primaryValue } : {}),
    high: Number(point.configuration.upperLimit),
    low: Number(point.configuration.lowerLimit),
  };
}

export class TelemetryService {
  constructor(
    private readonly repo: TelemetryRepository,
    private readonly warnings: WarningExecutionService,
    private readonly now: () => Date = () => new Date(),
    private readonly stream?: TelemetryStreamService,
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
    const receivedAt = this.now();
    const occurred = new Date(input.occurredAt);
    const occurredAt = occurred.toISOString();
    const clockDriftMs = receivedAt.getTime() - occurred.getTime();
    const maxFutureSkewMs = Number(process.env.QHSE_TELEMETRY_MAX_FUTURE_SKEW_MS || 60_000);
    if (clockDriftMs < -maxFutureSkewMs)
      throw new BadRequestException({
        code: 'TELEMETRY_CLOCK_AHEAD',
        message: '样本时间超出允许的未来时钟偏差',
        details: { clockDriftMs, maxFutureSkewMs },
      });
    const now = receivedAt.toISOString();
    const outOfOrder = Boolean(current.lastSampleAt && occurredAt <= current.lastSampleAt);
    const point: TelemetryPoint = {
      ...current,
      ...(outOfOrder
        ? {}
        : {
            currentMetrics: { ...current.currentMetrics, ...input.metrics },
            ...deriveState(current, input.metrics, input.quality),
            lastSampleAt: occurredAt,
            version: current.version + 1,
            updatedAt: now,
          }),
    };
    const result = await this.repo.ingest(
      point,
      {
        id: input.sampleId.trim(),
        pointId: current.id,
        source: current.source,
        occurredAt,
        metrics: input.metrics,
        quality: input.quality,
        createdAt: now,
      },
      !outOfOrder,
    );
    const evaluation =
      result.created && !outOfOrder && input.quality !== 'bad'
        ? await this.warnings.evaluate({
            source: current.source,
            subjectId: current.id,
            areaId: current.areaId,
            occurredAt,
            metrics: toWarningMetrics(current, input.metrics),
          })
        : undefined;
    const outcome = { ...result, evaluation, outOfOrder, clockDriftMs };
    if (result.created) this.stream?.publish(outcome);
    return outcome;
  }
  private notFound(): never {
    throw new NotFoundException({ code: 'TELEMETRY_POINT_NOT_FOUND', message: '遥测点位不存在' });
  }
}
