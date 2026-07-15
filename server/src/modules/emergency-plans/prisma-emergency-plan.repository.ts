import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  EmergencyPlanNotFoundError,
  type EmergencyPlanRepository,
  EmergencyPlanVersionConflictError,
} from './emergency-plan.repository';
import type {
  EmergencyDrill,
  EmergencyPlan,
  EmergencyPlanConfig,
  EmergencyPlanMutation,
  EmergencyPlanReviewStep,
  EmergencyPlanVersion,
} from './emergency-plan.types';
type Record = Awaited<ReturnType<PrismaService['emergencyPlanTemplate']['findFirstOrThrow']>>;
const json = (value: unknown) => value as Prisma.InputJsonValue;
const map = (r: Record): EmergencyPlan => ({
  id: r.id,
  code: r.code,
  ...(r.config as unknown as EmergencyPlanConfig),
  version: r.version,
  status: r.status as EmergencyPlan['status'],
  publishStatus: r.publishStatus as EmergencyPlan['publishStatus'],
  draft: r.draft && r.draft !== null ? (r.draft as unknown as EmergencyPlanConfig) : undefined,
  versions: r.versions as unknown as EmergencyPlanVersion[],
  reviewSteps:
    r.reviewSteps && r.reviewSteps !== null
      ? (r.reviewSteps as unknown as EmergencyPlanReviewStep[])
      : undefined,
  drills: r.drills as unknown as EmergencyDrill[],
  workflowId: r.workflowId ?? undefined,
  revision: r.revision,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});
@Injectable()
export class PrismaEmergencyPlanRepository implements EmergencyPlanRepository {
  constructor(private prisma: PrismaService) {}
  async findAll() {
    return (await this.prisma.emergencyPlanTemplate.findMany({ orderBy: { code: 'asc' } })).map(
      map,
    );
  }
  async findById(id: string) {
    const item = await this.prisma.emergencyPlanTemplate.findUnique({ where: { id } });
    return item ? map(item) : undefined;
  }
  async findByCode(code: string) {
    const item = await this.prisma.emergencyPlanTemplate.findUnique({ where: { code } });
    return item ? map(item) : undefined;
  }
  async create(plan: EmergencyPlan) {
    return map(
      await this.prisma.emergencyPlanTemplate.create({
        data: {
          id: plan.id,
          code: plan.code,
          config: json(config(plan)),
          version: plan.version,
          status: plan.status,
          publishStatus: plan.publishStatus,
          draft: plan.draft ? json(plan.draft) : Prisma.JsonNull,
          versions: json(plan.versions),
          reviewSteps: plan.reviewSteps ? json(plan.reviewSteps) : Prisma.JsonNull,
          drills: json(plan.drills),
          workflowId: plan.workflowId,
          revision: plan.revision,
          createdAt: new Date(plan.createdAt),
          updatedAt: new Date(plan.updatedAt),
        },
      }),
    );
  }
  async mutate(id: string, mutation: EmergencyPlanMutation, expected: number) {
    const current = await this.findById(id);
    if (!current) throw new EmergencyPlanNotFoundError();
    if (current.revision !== expected)
      throw new EmergencyPlanVersionConflictError(expected, current.revision);
    const versions = mutation.versionRecord
      ? [...current.versions, mutation.versionRecord]
      : current.versions;
    const drills =
      mutation.drills ?? (mutation.drill ? [...current.drills, mutation.drill] : current.drills);
    const updated = await this.prisma.emergencyPlanTemplate.updateMany({
      where: { id, revision: expected },
      data: {
        config: mutation.config ? json(mutation.config) : undefined,
        draft: mutation.clearDraft
          ? Prisma.JsonNull
          : mutation.draft
            ? json(mutation.draft)
            : undefined,
        publishStatus: mutation.publishStatus,
        status: mutation.status,
        version: mutation.version,
        versions: mutation.versionRecord ? json(versions) : undefined,
        reviewSteps: mutation.clearReviewSteps
          ? Prisma.JsonNull
          : mutation.reviewSteps
            ? json(mutation.reviewSteps)
            : undefined,
        drills: mutation.drill || mutation.drills ? json(drills) : undefined,
        workflowId: mutation.workflowId,
        revision: { increment: 1 },
        updatedAt: new Date(mutation.updatedAt),
      },
    });
    if (!updated.count) throw new EmergencyPlanVersionConflictError(expected, expected + 1);
    return this.findById(id) as Promise<EmergencyPlan>;
  }
}
function config(plan: EmergencyPlan): EmergencyPlanConfig {
  const {
    name,
    category,
    eventType,
    applicableArea,
    medium,
    responseLevel,
    triggerRule,
    notificationTargets,
    steps,
    resources,
    effectiveDate,
    expiryDate,
    ownerDepartment,
  } = plan;
  return {
    name,
    category,
    eventType,
    applicableArea,
    medium,
    responseLevel,
    triggerRule,
    notificationTargets,
    steps,
    resources,
    effectiveDate,
    expiryDate,
    ownerDepartment,
  };
}
