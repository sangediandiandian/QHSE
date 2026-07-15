import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { AuditRepository } from './audit.repository';
import type { AuditLogEntry, AuditQuery } from './audit.types';

@Injectable()
export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(entry: AuditLogEntry) {
    const created = await this.prisma.auditLog.create({
      data: {
        ...entry,
        detail: entry.detail as Prisma.InputJsonValue | undefined,
      },
    });
    return {
      ...created,
      actorId: created.actorId ?? undefined,
      actorName: created.actorName ?? undefined,
      resourceId: created.resourceId ?? undefined,
      ip: created.ip ?? undefined,
      detail: created.detail as Record<string, unknown> | undefined,
      result: created.result as AuditLogEntry['result'],
    };
  }

  async findAll(query: AuditQuery) {
    const records = await this.prisma.auditLog.findMany({
      where: {
        actorId: query.actorId,
        action: query.action ? { contains: query.action } : undefined,
        result: query.result,
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 100,
    });
    return records.map((record) => ({
      ...record,
      actorId: record.actorId ?? undefined,
      actorName: record.actorName ?? undefined,
      resourceId: record.resourceId ?? undefined,
      ip: record.ip ?? undefined,
      detail: record.detail as Record<string, unknown> | undefined,
      result: record.result as AuditLogEntry['result'],
    }));
  }
}
