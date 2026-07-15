import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  type WorkPermitRepository,
  WorkPermitNotFoundError,
  WorkPermitVersionConflictError,
} from './work-permit.repository';
import type { WorkPermit, WorkPermitMutation, WorkPermitQuery } from './work-permit.types';

const include = {
  approvalSteps: { orderBy: { sequence: 'asc' as const } },
  siteConfirmations: { orderBy: { confirmedAt: 'asc' as const } },
};
type Record = Prisma.WorkPermitGetPayload<{ include: typeof include }>;

@Injectable()
export class PrismaWorkPermitRepository implements WorkPermitRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: WorkPermitQuery) {
    const records = await this.prisma.workPermit.findMany({
      where: {
        areaId: getAreaFilter(query),
        status: query.status,
        type: query.type,
        riskLevel: query.riskLevel,
        OR: query.keyword
          ? [
              { code: { contains: query.keyword, mode: 'insensitive' } },
              { workContent: { contains: query.keyword, mode: 'insensitive' } },
              { areaName: { contains: query.keyword, mode: 'insensitive' } },
              { applicant: { contains: query.keyword, mode: 'insensitive' } },
              { guardian: { contains: query.keyword, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include,
      orderBy: [{ startAt: 'desc' }, { code: 'asc' }],
    });
    return records.map(mapRecord);
  }

  async findById(id: string, allowedAreaIds?: string[]) {
    const record = await this.prisma.workPermit.findFirst({
      where: { id, areaId: allowedAreaIds ? { in: allowedAreaIds } : undefined },
      include,
    });
    return record ? mapRecord(record) : undefined;
  }

  async create(permit: WorkPermit) {
    const record = await this.prisma.workPermit.create({
      data: {
        id: permit.id,
        code: permit.code,
        type: permit.type,
        areaId: permit.areaId,
        areaName: permit.areaName,
        workContent: permit.workContent,
        applicantId: permit.applicantId,
        applicant: permit.applicant,
        guardian: permit.guardian,
        startAt: toDateTime(permit.startAt),
        endAt: toDateTime(permit.endAt),
        riskLevel: permit.riskLevel,
        status: permit.status,
        gasTest: permit.gasTest,
        linkedGdsCodes: permit.linkedGdsCodes,
        safetyMeasures: permit.safetyMeasures,
        alertReason: permit.alertReason,
        workX: permit.workX,
        workY: permit.workY,
        version: permit.version,
        createdAt: new Date(permit.createdAt),
        updatedAt: new Date(permit.updatedAt),
        approvalSteps: {
          create: permit.approvalSteps.map(({ id, sequence, role, approver, status }) => ({
            id,
            sequence,
            role,
            approver,
            status,
          })),
        },
      },
      include,
    });
    return mapRecord(record);
  }

  async mutate(
    id: string,
    mutation: WorkPermitMutation,
    expectedVersion: number,
    allowedAreaIds?: string[],
  ) {
    const record = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.workPermit.updateMany({
        where: {
          id,
          version: expectedVersion,
          areaId: allowedAreaIds ? { in: allowedAreaIds } : undefined,
        },
        data: {
          status: mutation.status,
          gasTest: mutation.gasTest,
          alertReason: mutation.alertReason,
          version: { increment: 1 },
          updatedAt: new Date(mutation.updatedAt),
        },
      });
      if (!updated.count)
        await this.throwConflict(transaction, id, expectedVersion, allowedAreaIds);
      if (mutation.approval) {
        await transaction.workPermitApprovalStep.update({
          where: { id: mutation.approval.id },
          data: {
            approverId: mutation.approval.approverId,
            approver: mutation.approval.approver,
            status: mutation.approval.status,
            signedAt: mutation.approval.signedAt ? new Date(mutation.approval.signedAt) : undefined,
            signature: mutation.approval.signature,
          },
        });
      }
      if (mutation.confirmation) {
        await transaction.workPermitSiteConfirmation.create({
          data: {
            ...mutation.confirmation,
            confirmedAt: new Date(mutation.confirmation.confirmedAt),
            workPermitId: id,
          },
        });
      }
      return transaction.workPermit.findUniqueOrThrow({ where: { id }, include });
    });
    return mapRecord(record);
  }

  private async throwConflict(
    transaction: Prisma.TransactionClient,
    id: string,
    expectedVersion: number,
    allowedAreaIds?: string[],
  ): Promise<never> {
    const current = await transaction.workPermit.findFirst({
      where: { id, areaId: allowedAreaIds ? { in: allowedAreaIds } : undefined },
      select: { version: true },
    });
    if (!current) throw new WorkPermitNotFoundError();
    throw new WorkPermitVersionConflictError(expectedVersion, current.version);
  }
}

function getAreaFilter(query: WorkPermitQuery) {
  if (query.areaId)
    return query.areaIds && !query.areaIds.includes(query.areaId)
      ? '__not_authorized__'
      : query.areaId;
  return query.areaIds ? { in: query.areaIds } : undefined;
}

function mapRecord(record: Record): WorkPermit {
  return {
    ...record,
    type: record.type as WorkPermit['type'],
    riskLevel: record.riskLevel as WorkPermit['riskLevel'],
    status: record.status as WorkPermit['status'],
    startAt: formatDateTime(record.startAt),
    endAt: formatDateTime(record.endAt),
    alertReason: record.alertReason ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    approvalSteps: record.approvalSteps.map((step) => ({
      ...step,
      role: step.role as WorkPermit['approvalSteps'][number]['role'],
      status: step.status as WorkPermit['approvalSteps'][number]['status'],
      approverId: step.approverId ?? undefined,
      signedAt: step.signedAt?.toISOString(),
      signature: step.signature ?? undefined,
    })),
    siteConfirmations: record.siteConfirmations.map((item) => ({
      ...item,
      role: item.role as WorkPermit['siteConfirmations'][number]['role'],
      confirmedAt: item.confirmedAt.toISOString(),
    })),
  };
}

function toDateTime(value: string) {
  return new Date(`${value.replace(' ', 'T')}:00.000Z`);
}
function formatDateTime(value: Date) {
  return value.toISOString().slice(0, 16).replace('T', ' ');
}
