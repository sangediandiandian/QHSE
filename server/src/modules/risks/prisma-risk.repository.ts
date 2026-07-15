import { Injectable } from '@nestjs/common';
import { Prisma, type RiskLevel as PrismaRiskLevel } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  type RiskRepository,
  RiskNotFoundError,
  RiskVersionConflictError,
} from './risk.repository';
import type {
  RiskAssessment,
  RiskControl,
  RiskDynamicFactor,
  RiskLevel,
  RiskQuery,
  RiskUnit,
} from './risk.types';

type RiskRecord = Prisma.RiskUnitGetPayload<{
  include: { assessments: true; controlRecords: true };
}>;

@Injectable()
export class PrismaRiskRepository implements RiskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: RiskQuery) {
    const records = await this.prisma.riskUnit.findMany({
      where: {
        areaId: getAreaFilter(query),
        currentLevel: query.level as PrismaRiskLevel | undefined,
        OR: query.keyword ? [
          { code: { contains: query.keyword, mode: 'insensitive' } },
          { name: { contains: query.keyword, mode: 'insensitive' } },
          { owner: { contains: query.keyword, mode: 'insensitive' } },
          { areaName: { contains: query.keyword, mode: 'insensitive' } },
        ] : undefined,
      },
      include: { assessments: true, controlRecords: true },
      orderBy: { code: 'asc' },
    });
    return records.map(mapRiskRecord);
  }

  async findById(id: string, allowedAreaIds?: string[]) {
    const record = await this.prisma.riskUnit.findFirst({
      where: { id, areaId: allowedAreaIds ? { in: allowedAreaIds } : undefined },
      include: { assessments: true, controlRecords: true },
    });
    return record ? mapRiskRecord(record) : undefined;
  }

  async addAssessment(
    id: string,
    assessment: RiskAssessment,
    nextLevel: RiskLevel,
    expectedVersion?: number,
    allowedAreaIds?: string[],
  ) {
    const actualVersion = await this.getVersion(id, allowedAreaIds);
    const expected = expectedVersion ?? actualVersion;
    const record = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.riskUnit.updateMany({
        where: { id, version: expected, areaId: allowedAreaIds ? { in: allowedAreaIds } : undefined },
        data: {
          currentLevel: nextLevel as PrismaRiskLevel,
          version: { increment: 1 },
          updatedAt: assessment.assessedAt,
        },
      });
      if (updated.count === 0) await this.throwConflict(transaction, id, expected, allowedAreaIds);
      await transaction.riskAssessment.create({
        data: {
          ...assessment,
          level: assessment.level as PrismaRiskLevel,
          riskUnitId: id,
        },
      });
      return transaction.riskUnit.findUniqueOrThrow({
        where: { id },
        include: { assessments: true, controlRecords: true },
      });
    });
    return mapRiskRecord(record);
  }

  async replaceControls(
    id: string,
    controls: RiskControl[],
    expectedVersion?: number,
    allowedAreaIds?: string[],
  ) {
    const actualVersion = await this.getVersion(id, allowedAreaIds);
    const expected = expectedVersion ?? actualVersion;
    const record = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.riskUnit.updateMany({
        where: { id, version: expected, areaId: allowedAreaIds ? { in: allowedAreaIds } : undefined },
        data: {
          controls: controls.map((item) => item.content),
          version: { increment: 1 },
          updatedAt: controls[0].updatedAt,
        },
      });
      if (updated.count === 0) await this.throwConflict(transaction, id, expected, allowedAreaIds);
      await transaction.riskControl.deleteMany({ where: { riskUnitId: id } });
      await transaction.riskControl.createMany({
        data: controls.map((item) => ({ ...item, riskUnitId: id })),
      });
      return transaction.riskUnit.findUniqueOrThrow({
        where: { id },
        include: { assessments: true, controlRecords: true },
      });
    });
    return mapRiskRecord(record);
  }

  private async getVersion(id: string, allowedAreaIds?: string[]) {
    const record = await this.prisma.riskUnit.findFirst({
      where: { id, areaId: allowedAreaIds ? { in: allowedAreaIds } : undefined },
      select: { version: true },
    });
    if (!record) throw new RiskNotFoundError();
    return record.version;
  }

  private async throwConflict(
    transaction: Prisma.TransactionClient,
    id: string,
    expectedVersion: number,
    allowedAreaIds?: string[],
  ): Promise<never> {
    const current = await transaction.riskUnit.findFirst({
      where: { id, areaId: allowedAreaIds ? { in: allowedAreaIds } : undefined },
      select: { version: true },
    });
    if (!current) throw new RiskNotFoundError();
    throw new RiskVersionConflictError(expectedVersion, current.version);
  }
}

function getAreaFilter(query: RiskQuery) {
  if (query.areaId) {
    return query.areaIds && !query.areaIds.includes(query.areaId) ? '__not_authorized__' : query.areaId;
  }
  return query.areaIds ? { in: query.areaIds } : undefined;
}

function mapRiskRecord(record: RiskRecord): RiskUnit {
  return {
    ...record,
    staticLevel: record.staticLevel as RiskLevel,
    currentLevel: record.currentLevel as RiskLevel,
    dynamicFactors: record.dynamicFactors as unknown as RiskDynamicFactor[],
    assessments: record.assessments.map((item) => ({
      ...item,
      method: 'LEC',
      level: item.level as RiskLevel,
    })),
    controlRecords: record.controlRecords.map((item) => ({
      ...item,
      status: item.status as RiskControl['status'],
    })),
  };
}
