import { Injectable } from '@nestjs/common';
import { Prisma, type RiskLevel as PrismaRiskLevel } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { WarningExecutionRepository } from './warning-execution.repository';
import type { MetricValue, WarningEvaluationState, WarningSignal } from './warning-execution.types';

@Injectable()
export class PrismaWarningExecutionRepository implements WarningExecutionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getState(ruleId: string, subjectId: string) {
    const record = await this.prisma.warningEvaluationState.findUnique({
      where: { ruleId_subjectId: { ruleId, subjectId } },
    });
    return record ? mapState(record) : undefined;
  }

  async saveState(state: WarningEvaluationState) {
    const data = {
      latestMetrics: state.latestMetrics as unknown as Prisma.InputJsonValue,
      metricTimes: state.metricTimes as unknown as Prisma.InputJsonValue,
      conditionSince: state.conditionSince ? new Date(state.conditionSince) : null,
      lastEvaluatedAt: new Date(state.lastEvaluatedAt),
      updatedAt: new Date(state.updatedAt),
    };
    return mapState(
      await this.prisma.warningEvaluationState.upsert({
        where: { ruleId_subjectId: { ruleId: state.ruleId, subjectId: state.subjectId } },
        update: data,
        create: {
          id: state.id,
          ruleId: state.ruleId,
          subjectId: state.subjectId,
          ...data,
          createdAt: new Date(state.createdAt),
        },
      }),
    );
  }

  async findRecentActiveSignal(ruleId: string, subjectId: string, since: string) {
    const record = await this.prisma.warningSignal.findFirst({
      where: { ruleId, subjectId, status: 'active', occurredAt: { gte: new Date(since) } },
      orderBy: { occurredAt: 'desc' },
    });
    return record ? mapSignal(record) : undefined;
  }

  async createSignal(signal: WarningSignal) {
    return mapSignal(
      await this.prisma.warningSignal.create({
        data: {
          ...signal,
          areaId: signal.areaId,
          level: signal.level as PrismaRiskLevel,
          occurredAt: new Date(signal.occurredAt),
          createdAt: new Date(signal.createdAt),
        },
      }),
    );
  }

  async listSignals(limit = 100) {
    return (
      await this.prisma.warningSignal.findMany({ orderBy: { occurredAt: 'desc' }, take: limit })
    ).map(mapSignal);
  }
}

function mapState(record: {
  id: string;
  ruleId: string;
  subjectId: string;
  latestMetrics: Prisma.JsonValue;
  metricTimes: Prisma.JsonValue;
  conditionSince: Date | null;
  lastEvaluatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): WarningEvaluationState {
  return {
    id: record.id,
    ruleId: record.ruleId,
    subjectId: record.subjectId,
    latestMetrics: record.latestMetrics as Record<string, MetricValue>,
    metricTimes: record.metricTimes as Record<string, string>,
    conditionSince: record.conditionSince?.toISOString(),
    lastEvaluatedAt: record.lastEvaluatedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapSignal(record: {
  id: string;
  code: string;
  ruleId: string;
  ruleCode: string;
  subjectId: string;
  areaId: string | null;
  source: string;
  level: PrismaRiskLevel;
  title: string;
  detail: string;
  occurredAt: Date;
  status: string;
  createdAt: Date;
}): WarningSignal {
  return {
    ...record,
    areaId: record.areaId ?? undefined,
    level: record.level,
    occurredAt: record.occurredAt.toISOString(),
    status: record.status as WarningSignal['status'],
    createdAt: record.createdAt.toISOString(),
  };
}
