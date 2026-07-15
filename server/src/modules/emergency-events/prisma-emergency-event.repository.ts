import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  EmergencyEventNotFoundError,
  type EmergencyEventRepository,
  EmergencyEventVersionConflictError,
} from './emergency-event.repository';
import type {
  EmergencyClosureApproval,
  EmergencyEvent,
  EmergencyEventEvidence,
  EmergencyEventMutation,
  EmergencyEventOperation,
  EmergencyEventQuery,
} from './emergency-event.types';

type Record = Awaited<ReturnType<PrismaService['emergencyEvent']['findFirstOrThrow']>>;

@Injectable()
export class PrismaEmergencyEventRepository implements EmergencyEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: EmergencyEventQuery) {
    const records = await this.prisma.emergencyEvent.findMany({
      where: {
        areaId: areaFilter(query),
        status: query.status,
        OR: query.keyword
          ? [
              { code: { contains: query.keyword, mode: 'insensitive' } },
              { title: { contains: query.keyword, mode: 'insensitive' } },
              { areaName: { contains: query.keyword, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: { updatedAt: 'desc' },
    });
    return records.map(mapRecord);
  }

  async findById(id: string, allowedAreaIds?: string[]) {
    const record = await this.prisma.emergencyEvent.findFirst({
      where: { id, areaId: allowedAreaIds ? { in: allowedAreaIds } : undefined },
    });
    return record ? mapRecord(record) : undefined;
  }

  async findByEventId(eventId: string) {
    const record = await this.prisma.emergencyEvent.findUnique({ where: { eventId } });
    return record ? mapRecord(record) : undefined;
  }

  async create(event: EmergencyEvent) {
    return mapRecord(await this.prisma.emergencyEvent.create({ data: toData(event) }));
  }

  async mutate(
    id: string,
    mutation: EmergencyEventMutation,
    expectedVersion: number,
    allowedAreaIds?: string[],
  ) {
    const record = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.emergencyEvent.findFirst({
        where: { id, areaId: allowedAreaIds ? { in: allowedAreaIds } : undefined },
      });
      if (!current) throw new EmergencyEventNotFoundError();
      if (current.version !== expectedVersion)
        throw new EmergencyEventVersionConflictError(expectedVersion, current.version);
      const operations = current.operations as unknown as EmergencyEventOperation[];
      const evidence = current.evidence as unknown as EmergencyEventEvidence[];
      const updated = await transaction.emergencyEvent.updateMany({
        where: { id, version: expectedVersion },
        data: {
          status: mutation.status,
          responseLevel: mutation.responseLevel,
          commander: mutation.commander,
          operations: mutation.operation ? json([...operations, mutation.operation]) : undefined,
          evidence: mutation.evidence ? json([...evidence, mutation.evidence]) : undefined,
          closureApproval: mutation.closureApproval ? json(mutation.closureApproval) : undefined,
          closureWorkflowId: mutation.closureWorkflowId,
          updatedAt: new Date(mutation.updatedAt),
          version: { increment: 1 },
        },
      });
      if (!updated.count)
        throw new EmergencyEventVersionConflictError(expectedVersion, expectedVersion + 1);
      return transaction.emergencyEvent.findUniqueOrThrow({ where: { id } });
    });
    return mapRecord(record);
  }
}

function areaFilter(query: EmergencyEventQuery) {
  if (query.areaId)
    return query.areaIds && !query.areaIds.includes(query.areaId)
      ? '__not_authorized__'
      : query.areaId;
  return query.areaIds ? { in: query.areaIds } : undefined;
}

function json(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function toData(event: EmergencyEvent) {
  return {
    id: event.id,
    eventId: event.eventId,
    code: event.code,
    title: event.title,
    areaId: event.areaId,
    areaName: event.areaName,
    source: event.source,
    status: event.status,
    responseLevel: event.responseLevel,
    commander: event.commander,
    ownerDepartment: event.ownerDepartment,
    startedAt: new Date(event.startedAt),
    summary: event.summary,
    operations: json(event.operations),
    evidence: json(event.evidence),
    closureApproval: event.closureApproval ? json(event.closureApproval) : Prisma.JsonNull,
    closureWorkflowId: event.closureWorkflowId,
    version: event.version,
    createdAt: new Date(event.createdAt),
    updatedAt: new Date(event.updatedAt),
  };
}

function mapRecord(record: Record): EmergencyEvent {
  return {
    ...record,
    source: record.source as EmergencyEvent['source'],
    status: record.status as EmergencyEvent['status'],
    responseLevel: record.responseLevel as EmergencyEvent['responseLevel'],
    startedAt: record.startedAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    operations: record.operations as unknown as EmergencyEventOperation[],
    evidence: record.evidence as unknown as EmergencyEventEvidence[],
    closureApproval:
      record.closureApproval && !isJsonNull(record.closureApproval)
        ? (record.closureApproval as unknown as EmergencyClosureApproval)
        : undefined,
    closureWorkflowId: record.closureWorkflowId ?? undefined,
  };
}

function isJsonNull(value: Prisma.JsonValue) {
  return value === null;
}
