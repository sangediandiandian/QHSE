import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  type WorkflowRepository,
  WorkflowNotFoundError,
  WorkflowVersionConflictError,
} from './workflow.repository';
import type { WorkflowInstance, WorkflowMutation } from './workflow.types';

const include = { steps: { orderBy: { sequence: 'asc' as const } } };
type Record = Prisma.WorkflowInstanceGetPayload<{ include: typeof include }>;

@Injectable()
export class PrismaWorkflowRepository implements WorkflowRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const record = await this.prisma.workflowInstance.findUnique({ where: { id }, include });
    return record ? mapRecord(record) : undefined;
  }

  async findByBusiness(businessType: string, businessId: string) {
    const record = await this.prisma.workflowInstance.findFirst({
      where: { businessType, businessId },
      include,
      orderBy: { createdAt: 'desc' },
    });
    return record ? mapRecord(record) : undefined;
  }

  async create(instance: WorkflowInstance) {
    const record = await this.prisma.workflowInstance.create({
      data: {
        id: instance.id,
        businessType: instance.businessType,
        businessId: instance.businessId,
        title: instance.title,
        status: instance.status,
        createdById: instance.createdById,
        createdByName: instance.createdByName,
        version: instance.version,
        createdAt: new Date(instance.createdAt),
        updatedAt: new Date(instance.updatedAt),
        steps: {
          create: instance.steps.map(({ id, sequence, name, allowedRoleCodes, status }) => ({
            id,
            sequence,
            name,
            allowedRoleCodes,
            status,
          })),
        },
      },
      include,
    });
    return mapRecord(record);
  }

  async mutate(id: string, mutation: WorkflowMutation, expectedVersion: number) {
    const record = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.workflowInstance.updateMany({
        where: { id, version: expectedVersion },
        data: {
          status: mutation.status,
          version: { increment: 1 },
          updatedAt: new Date(mutation.updatedAt),
        },
      });
      if (!updated.count) await this.throwConflict(transaction, id, expectedVersion);
      if (mutation.step) {
        await transaction.workflowStep.update({
          where: { id: mutation.step.id },
          data: {
            status: mutation.step.status,
            actorId: mutation.step.actorId,
            actorName: mutation.step.actorName,
            opinion: mutation.step.opinion,
            actedAt: mutation.step.actedAt ? new Date(mutation.step.actedAt) : undefined,
          },
        });
      }
      return transaction.workflowInstance.findUniqueOrThrow({ where: { id }, include });
    });
    return mapRecord(record);
  }

  private async throwConflict(
    transaction: Prisma.TransactionClient,
    id: string,
    expectedVersion: number,
  ): Promise<never> {
    const current = await transaction.workflowInstance.findUnique({
      where: { id },
      select: { version: true },
    });
    if (!current) throw new WorkflowNotFoundError();
    throw new WorkflowVersionConflictError(expectedVersion, current.version);
  }
}

function mapRecord(record: Record): WorkflowInstance {
  return {
    ...record,
    status: record.status as WorkflowInstance['status'],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    steps: record.steps.map((step) => ({
      ...step,
      status: step.status as WorkflowInstance['steps'][number]['status'],
      actorId: step.actorId ?? undefined,
      actorName: step.actorName ?? undefined,
      opinion: step.opinion ?? undefined,
      actedAt: step.actedAt?.toISOString(),
    })),
  };
}
