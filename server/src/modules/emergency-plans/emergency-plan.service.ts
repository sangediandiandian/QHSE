import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { WorkflowActor, WorkflowService } from '../workflows/workflow.service';
import type {
  AddDrillDto,
  ApprovePlanDto,
  PlanRevisionDto,
  RecordDrillDto,
  RollbackPlanDto,
  SaveEmergencyPlanDto,
} from './emergency-plan.dto';
import {
  EmergencyPlanNotFoundError,
  type EmergencyPlanRepository,
  EmergencyPlanVersionConflictError,
} from './emergency-plan.repository';
import type {
  EmergencyPlan,
  EmergencyPlanConfig,
  EmergencyPlanReviewStep,
} from './emergency-plan.types';
interface Options {
  now?: () => Date;
  id?: () => string;
}
export class EmergencyPlanService {
  private now: () => Date;
  private id: () => string;
  constructor(
    private repo: EmergencyPlanRepository,
    private workflows: WorkflowService,
    options: Options = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.id = options.id ?? randomUUID;
  }
  list() {
    return this.repo.findAll();
  }
  async get(id: string) {
    const plan = await this.repo.findById(id);
    if (!plan) this.notFound();
    return plan;
  }
  async save(id: string | undefined, input: SaveEmergencyPlanDto) {
    const config = toConfig(input);
    validateConfig(config);
    const timestamp = this.now().toISOString();
    if (!id) {
      if (await this.repo.findByCode(input.code.trim().toUpperCase()))
        throw new ConflictException({ code: 'PLAN_CODE_EXISTS', message: '预案编码已存在' });
      const planId = this.id();
      return this.repo.create({
        id: planId,
        code: input.code.trim().toUpperCase(),
        ...config,
        version: '未发布',
        status: '已停用',
        publishStatus: '草稿',
        draft: config,
        versions: [],
        drills: [],
        revision: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
    const plan = await this.get(id);
    if (plan.publishStatus === '待评审') this.state(plan, '编辑');
    return this.mutate(plan, input.expectedRevision, {
      draft: config,
      publishStatus: '草稿',
      clearReviewSteps: true,
      updatedAt: timestamp,
    });
  }
  async submit(id: string, input: PlanRevisionDto, actor: WorkflowActor) {
    const plan = await this.get(id);
    if (plan.publishStatus !== '草稿' || !plan.draft) this.state(plan, '提交评审');
    const workflow = await this.workflows.create(
      {
        businessType: 'emergency_plan_publish',
        businessId: plan.id,
        title: `${plan.code} 预案发布评审`,
        steps: [
          { name: 'QHSE 评审', allowedRoleCodes: ['qhse_manager'] },
          { name: '生产负责人会签', allowedRoleCodes: ['production_dispatcher'] },
        ],
      },
      actor,
    );
    const steps: EmergencyPlanReviewStep[] = [
      { role: 'QHSE 评审', reviewer: 'QHSE 管理部', status: '待评审' },
      { role: '生产负责人会签', reviewer: '生产调度', status: '待评审' },
    ];
    return this.mutate(plan, input.expectedRevision, {
      publishStatus: '待评审',
      workflowId: workflow.id,
      reviewSteps: steps,
      updatedAt: this.now().toISOString(),
    });
  }
  async approve(id: string, input: ApprovePlanDto, actor: WorkflowActor) {
    const plan = await this.get(id);
    if (plan.publishStatus !== '待评审' || !plan.workflowId || !plan.draft)
      this.state(plan, '评审');
    const workflow = await this.workflows.get(plan.workflowId);
    const approved = await this.workflows.approve(
      plan.workflowId,
      input.opinion ?? '评审通过',
      input.workflowVersion ?? workflow.version,
      actor,
    );
    const steps = plan.reviewSteps?.map((step, index) =>
      index === approved.steps.findIndex((item) => item.actorId === actor.actorId)
        ? {
            ...step,
            reviewer: actor.actorName,
            status: '已通过' as const,
            reviewedAt: this.now().toISOString(),
            signature: `${actor.actorName} / ${step.role}`,
          }
        : step,
    );
    if (approved.status !== '已通过')
      return this.mutate(plan, input.expectedRevision, {
        reviewSteps: steps,
        updatedAt: this.now().toISOString(),
      });
    const version = nextVersion(plan.version);
    const publishedAt = this.now().toISOString();
    return this.mutate(plan, input.expectedRevision, {
      config: plan.draft,
      clearDraft: true,
      publishStatus: '已发布',
      status: '生效中',
      version,
      versionRecord: {
        ...plan.draft,
        version,
        publishedAt,
        publisher: actor.actorName,
        publisherId: actor.actorId,
      },
      reviewSteps: steps,
      updatedAt: publishedAt,
    });
  }
  async rollback(id: string, input: RollbackPlanDto) {
    const plan = await this.get(id);
    const target = plan.versions.find((item) => item.version === input.version);
    if (!target)
      throw new NotFoundException({ code: 'PLAN_VERSION_NOT_FOUND', message: '预案版本不存在' });
    return this.mutate(plan, input.expectedRevision, {
      draft: toConfig(target),
      publishStatus: '草稿',
      clearReviewSteps: true,
      updatedAt: this.now().toISOString(),
    });
  }
  async addDrill(id: string, input: AddDrillDto) {
    const plan = await this.get(id);
    const { expectedRevision: _, ...fields } = input;
    return this.mutate(plan, input.expectedRevision, {
      drill: { id: this.id(), ...fields, status: '计划中' },
      updatedAt: this.now().toISOString(),
    });
  }
  async startDrill(id: string, drillId: string, input: PlanRevisionDto) {
    const plan = await this.get(id);
    const drill = plan.drills.find((item) => item.id === drillId);
    if (!drill || drill.status !== '计划中')
      throw new ConflictException({
        code: 'DRILL_STATE_CONFLICT',
        message: '演练当前状态不能开始',
      });
    return this.mutate(plan, input.expectedRevision, {
      drills: plan.drills.map((item) =>
        item.id === drillId
          ? { ...item, status: '待复盘', startedAt: this.now().toISOString() }
          : item,
      ),
      updatedAt: this.now().toISOString(),
    });
  }
  async recordDrill(id: string, drillId: string, input: RecordDrillDto) {
    const plan = await this.get(id);
    const drill = plan.drills.find((item) => item.id === drillId);
    if (!drill || drill.status !== '待复盘')
      throw new ConflictException({
        code: 'DRILL_STATE_CONFLICT',
        message: '演练当前状态不能复盘',
      });
    return this.mutate(plan, input.expectedRevision, {
      drills: plan.drills.map((item) =>
        item.id === drillId
          ? {
              ...item,
              status: '已完成',
              completedAt: this.now().toISOString(),
              score: input.score,
              summary: input.summary.trim(),
              issues: input.issues,
            }
          : item,
      ),
      updatedAt: this.now().toISOString(),
    });
  }
  private async mutate(
    plan: EmergencyPlan,
    expected: number | undefined,
    mutation: Parameters<EmergencyPlanRepository['mutate']>[1],
  ) {
    try {
      return await this.repo.mutate(plan.id, mutation, expected ?? plan.revision);
    } catch (error) {
      if (error instanceof EmergencyPlanNotFoundError) this.notFound();
      if (error instanceof EmergencyPlanVersionConflictError)
        throw new ConflictException({
          code: 'VERSION_CONFLICT',
          message: '预案已被其他用户更新，请刷新后重试',
        });
      throw error;
    }
  }
  private state(plan: EmergencyPlan, action: string): never {
    throw new ConflictException({
      code: 'PLAN_STATE_CONFLICT',
      message: `预案状态“${plan.publishStatus}”不能执行“${action}”`,
    });
  }
  private notFound(): never {
    throw new NotFoundException({ code: 'PLAN_NOT_FOUND', message: '应急预案不存在' });
  }
}
const nextVersion = (version: string) => {
  const match = /^V(\d+)\.(\d+)$/.exec(version);
  return match ? `V${match[1]}.${Number(match[2]) + 1}` : 'V1.0';
};
function toConfig(input: EmergencyPlanConfig): EmergencyPlanConfig {
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
  } = input;
  return {
    name: name.trim(),
    category,
    eventType: eventType.trim(),
    applicableArea: applicableArea.trim(),
    medium: medium.trim(),
    responseLevel,
    triggerRule: triggerRule.trim(),
    notificationTargets,
    steps,
    resources,
    effectiveDate,
    expiryDate,
    ownerDepartment: ownerDepartment.trim(),
  };
}
function validateConfig(config: EmergencyPlanConfig) {
  if (config.expiryDate <= config.effectiveDate)
    throw new BadRequestException({
      code: 'PLAN_DATE_INVALID',
      message: '到期日期必须晚于生效日期',
    });
}
