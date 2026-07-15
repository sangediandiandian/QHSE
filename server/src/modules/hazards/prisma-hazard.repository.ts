import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  type HazardRepository,
  HazardNotFoundError,
  HazardVersionConflictError,
} from './hazard.repository';
import type {
  Hazard,
  HazardEvidenceCategory,
  HazardLevel,
  HazardMutation,
  HazardQuery,
  HazardSource,
  HazardStatus,
} from './hazard.types';

const hazardInclude = {
  evidence: { orderBy: { uploadedAt: 'asc' as const } },
  operations: { orderBy: { operatedAt: 'asc' as const } },
};

type HazardRecord = Prisma.HazardGetPayload<{ include: typeof hazardInclude }>;

@Injectable()
export class PrismaHazardRepository implements HazardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: HazardQuery) {
    const records = await this.prisma.hazard.findMany({
      where: {
        areaId: getAreaFilter(query),
        status: query.status,
        level: query.level,
        supervised: query.supervised,
        OR: query.keyword
          ? [
              { code: { contains: query.keyword, mode: 'insensitive' } },
              { title: { contains: query.keyword, mode: 'insensitive' } },
              { areaName: { contains: query.keyword, mode: 'insensitive' } },
              { owner: { contains: query.keyword, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: hazardInclude,
      orderBy: [{ deadline: 'asc' }, { code: 'asc' }],
    });
    return records
      .map(mapHazardRecord)
      .filter((item) => query.overdue === undefined || item.overdue === query.overdue);
  }

  async findById(id: string, allowedAreaIds?: string[]) {
    const record = await this.prisma.hazard.findFirst({
      where: { id, areaId: allowedAreaIds ? { in: allowedAreaIds } : undefined },
      include: hazardInclude,
    });
    return record ? mapHazardRecord(record) : undefined;
  }

  async create(hazard: Hazard) {
    const record = await this.prisma.hazard.create({
      data: {
        id: hazard.id,
        code: hazard.code,
        title: hazard.title,
        areaId: hazard.areaId,
        areaName: hazard.areaName,
        level: hazard.level,
        source: hazard.source,
        category: hazard.category,
        ownerDepartment: hazard.ownerDepartment,
        owner: hazard.owner,
        discoveredAt: toDate(hazard.discoveredAt),
        deadline: toDate(hazard.deadline),
        status: hazard.status,
        riskUnitId: hazard.riskUnitId,
        recurrenceCount: hazard.recurrenceCount,
        description: hazard.description,
        measures: hazard.measures,
        supervised: hazard.supervised,
        acceptanceOpinion: hazard.acceptanceOpinion,
        version: hazard.version,
        createdAt: new Date(hazard.createdAt),
        updatedAt: new Date(hazard.updatedAt),
        operations: {
          create: hazard.operations.map(
            ({ id, action, operatorId, operator, operatedAt, detail }) => ({
              id,
              action,
              operatorId,
              operator,
              operatedAt: new Date(operatedAt),
              detail,
            }),
          ),
        },
      },
      include: hazardInclude,
    });
    return mapHazardRecord(record);
  }

  async mutate(
    id: string,
    mutation: HazardMutation,
    expectedVersion: number,
    allowedAreaIds?: string[],
  ) {
    const record = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.hazard.updateMany({
        where: {
          id,
          version: expectedVersion,
          areaId: allowedAreaIds ? { in: allowedAreaIds } : undefined,
        },
        data: {
          status: mutation.status,
          supervised: mutation.supervised,
          acceptanceOpinion: mutation.acceptanceOpinion,
          version: { increment: 1 },
          updatedAt: new Date(mutation.updatedAt),
        },
      });
      if (updated.count === 0) {
        await this.throwConflict(transaction, id, expectedVersion, allowedAreaIds);
      }
      if (mutation.evidence) {
        await transaction.hazardEvidence.create({
          data: {
            ...mutation.evidence,
            uploadedAt: new Date(mutation.evidence.uploadedAt),
            hazardId: id,
          },
        });
      }
      if (mutation.operation) {
        await transaction.hazardOperation.create({
          data: {
            ...mutation.operation,
            operatedAt: new Date(mutation.operation.operatedAt),
            hazardId: id,
          },
        });
      }
      return transaction.hazard.findUniqueOrThrow({ where: { id }, include: hazardInclude });
    });
    return mapHazardRecord(record);
  }

  private async throwConflict(
    transaction: Prisma.TransactionClient,
    id: string,
    expectedVersion: number,
    allowedAreaIds?: string[],
  ): Promise<never> {
    const current = await transaction.hazard.findFirst({
      where: { id, areaId: allowedAreaIds ? { in: allowedAreaIds } : undefined },
      select: { version: true },
    });
    if (!current) throw new HazardNotFoundError();
    throw new HazardVersionConflictError(expectedVersion, current.version);
  }
}

function getAreaFilter(query: HazardQuery) {
  if (query.areaId) {
    return query.areaIds && !query.areaIds.includes(query.areaId)
      ? '__not_authorized__'
      : query.areaId;
  }
  return query.areaIds ? { in: query.areaIds } : undefined;
}

function mapHazardRecord(record: HazardRecord): Hazard {
  const deadline = formatDate(record.deadline);
  return {
    ...record,
    level: record.level as HazardLevel,
    source: record.source as HazardSource,
    status: record.status as HazardStatus,
    acceptanceOpinion: record.acceptanceOpinion ?? undefined,
    discoveredAt: formatDate(record.discoveredAt),
    deadline,
    overdue: record.status !== '已关闭' && deadline < formatDate(new Date()),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    evidence: record.evidence.map((item) => ({
      ...item,
      category: item.category as HazardEvidenceCategory,
      uploadedAt: item.uploadedAt.toISOString(),
      note: item.note ?? undefined,
    })),
    operations: record.operations.map((item) => ({
      ...item,
      action: item.action as Hazard['operations'][number]['action'],
      operatedAt: item.operatedAt.toISOString(),
    })),
  };
}

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}
