import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { TelemetryPointQuery, TelemetryRepository } from './telemetry.repository';
import type { TelemetryPoint, TelemetrySample } from './telemetry.types';
type PointRecord = Awaited<ReturnType<PrismaService['telemetryPoint']['findFirstOrThrow']>>;
type SampleRecord = Awaited<ReturnType<PrismaService['telemetrySample']['findFirstOrThrow']>>;
const mapPoint = (record: PointRecord): TelemetryPoint => ({
  ...record,
  source: record.source as TelemetryPoint['source'],
  configuration: record.configuration as TelemetryPoint['configuration'],
  currentMetrics: record.currentMetrics as TelemetryPoint['currentMetrics'],
  onlineStatus: record.onlineStatus as TelemetryPoint['onlineStatus'],
  lastSampleAt: record.lastSampleAt?.toISOString(),
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});
const mapSample = (record: SampleRecord): TelemetrySample => ({
  ...record,
  source: record.source as TelemetrySample['source'],
  metrics: record.metrics as TelemetrySample['metrics'],
  quality: record.quality as TelemetrySample['quality'],
  occurredAt: record.occurredAt.toISOString(),
  createdAt: record.createdAt.toISOString(),
});
@Injectable()
export class PrismaTelemetryRepository implements TelemetryRepository {
  constructor(private readonly prisma: PrismaService) {}
  async listPoints(query: TelemetryPointQuery) {
    const { areaIds, ...where } = query;
    return (
      await this.prisma.telemetryPoint.findMany({
        where: {
          ...where,
          areaId: areaIds
            ? query.areaId && !areaIds.includes(query.areaId)
              ? '__not_authorized__'
              : (query.areaId ?? { in: areaIds })
            : query.areaId,
        },
        orderBy: { code: 'asc' },
      })
    ).map(mapPoint);
  }
  async findPoint(id: string) {
    const item = await this.prisma.telemetryPoint.findUnique({ where: { id } });
    return item ? mapPoint(item) : undefined;
  }
  async listSamples(pointId: string, limit: number) {
    return (
      await this.prisma.telemetrySample.findMany({
        where: { pointId },
        orderBy: { occurredAt: 'desc' },
        take: limit,
      })
    ).map(mapSample);
  }
  async ingest(point: TelemetryPoint, sample: TelemetrySample, updatePoint = true) {
    const existing = await this.prisma.telemetrySample.findUnique({ where: { id: sample.id } });
    if (existing)
      return {
        point: mapPoint(
          await this.prisma.telemetryPoint.findUniqueOrThrow({ where: { id: point.id } }),
        ),
        sample: mapSample(existing),
        created: false,
      };
    try {
      if (!updatePoint) {
        const created = await this.prisma.telemetrySample.create({
          data: {
            id: sample.id,
            pointId: sample.pointId,
            source: sample.source,
            occurredAt: new Date(sample.occurredAt),
            metrics: sample.metrics as Prisma.InputJsonValue,
            quality: sample.quality,
            createdAt: new Date(sample.createdAt),
          },
        });
        const current = await this.prisma.telemetryPoint.findUniqueOrThrow({
          where: { id: point.id },
        });
        return { point: mapPoint(current), sample: mapSample(created), created: true };
      }
      const [updated, created] = await this.prisma.$transaction([
        this.prisma.telemetryPoint.update({
          where: { id: point.id },
          data: {
            currentMetrics: point.currentMetrics as Prisma.InputJsonValue,
            status: point.status,
            onlineStatus: point.onlineStatus,
            lastSampleAt: new Date(sample.occurredAt),
            version: { increment: 1 },
            updatedAt: new Date(point.updatedAt),
          },
        }),
        this.prisma.telemetrySample.create({
          data: {
            id: sample.id,
            pointId: sample.pointId,
            source: sample.source,
            occurredAt: new Date(sample.occurredAt),
            metrics: sample.metrics as Prisma.InputJsonValue,
            quality: sample.quality,
            createdAt: new Date(sample.createdAt),
          },
        }),
      ]);
      return { point: mapPoint(updated), sample: mapSample(created), created: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const duplicate = await this.prisma.telemetrySample.findUniqueOrThrow({
          where: { id: sample.id },
        });
        return {
          point: mapPoint(
            await this.prisma.telemetryPoint.findUniqueOrThrow({ where: { id: point.id } }),
          ),
          sample: mapSample(duplicate),
          created: false,
        };
      }
      throw error;
    }
  }
}
