import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  type WorkflowRepository,
  WorkflowNotFoundError,
  WorkflowVersionConflictError,
} from './workflow.repository';
import type { CreateWorkflowInput, WorkflowInstance } from './workflow.types';

export interface WorkflowActor {
  actorId: string;
  actorName: string;
  roleCodes: string[];
}

interface WorkflowServiceOptions {
  now?: () => Date;
  createId?: () => string;
}

export class WorkflowService {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(
    private readonly repository: WorkflowRepository,
    options: WorkflowServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  async get(id: string) {
    const instance = await this.repository.findById(id);
    if (!instance) this.throwNotFound();
    return instance;
  }

  async getByBusiness(businessType: string, businessId: string) {
    const instance = await this.repository.findByBusiness(businessType, businessId);
    if (!instance) this.throwNotFound();
    return instance;
  }

  async create(input: CreateWorkflowInput, actor: WorkflowActor) {
    const existing = await this.repository.findByBusiness(input.businessType, input.businessId);
    if (existing?.status === '进行中') {
      throw new ConflictException({
        code: 'WORKFLOW_ALREADY_ACTIVE',
        message: '该业务已有进行中的审批流程',
      });
    }
    if (
      !input.steps.length ||
      input.steps.some((step) => !step.name.trim() || !step.allowedRoleCodes.length)
    ) {
      throw new ConflictException({
        code: 'INVALID_WORKFLOW_DEFINITION',
        message: '审批流程至少需要一个配置完整的节点',
      });
    }
    const timestamp = this.now().toISOString();
    return this.repository.create({
      id: this.createId(),
      businessType: input.businessType,
      businessId: input.businessId,
      title: input.title.trim(),
      status: '进行中',
      createdById: actor.actorId,
      createdByName: actor.actorName,
      steps: input.steps.map((step, index) => ({
        id: this.createId(),
        sequence: index + 1,
        name: step.name.trim(),
        allowedRoleCodes: [...step.allowedRoleCodes],
        status: '待审批',
      })),
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  async approve(
    id: string,
    opinion: string,
    expectedVersion: number | undefined,
    actor: WorkflowActor,
  ) {
    return this.act(id, opinion, expectedVersion, actor, '已通过');
  }

  async reject(
    id: string,
    opinion: string,
    expectedVersion: number | undefined,
    actor: WorkflowActor,
  ) {
    if (!opinion.trim())
      throw new ConflictException({
        code: 'WORKFLOW_OPINION_REQUIRED',
        message: '驳回时必须填写意见',
      });
    return this.act(id, opinion, expectedVersion, actor, '已驳回');
  }

  async withdraw(id: string, expectedVersion: number | undefined, actor: WorkflowActor) {
    const instance = await this.get(id);
    this.ensureActive(instance);
    if (instance.createdById !== actor.actorId && !actor.roleCodes.includes('system_admin')) {
      throw new ForbiddenException({
        code: 'WORKFLOW_WITHDRAW_FORBIDDEN',
        message: '仅流程发起人可以撤回',
      });
    }
    return this.mutate(instance, expectedVersion, {
      status: '已撤回',
      updatedAt: this.now().toISOString(),
    });
  }

  private async act(
    id: string,
    opinion: string,
    expectedVersion: number | undefined,
    actor: WorkflowActor,
    status: '已通过' | '已驳回',
  ) {
    const instance = await this.get(id);
    this.ensureActive(instance);
    const step = instance.steps.find((item) => item.status === '待审批');
    if (!step)
      throw new ConflictException({ code: 'WORKFLOW_COMPLETE', message: '审批流程已完成' });
    if (
      !actor.roleCodes.includes('system_admin') &&
      !step.allowedRoleCodes.some((role) => actor.roleCodes.includes(role))
    ) {
      throw new ForbiddenException({
        code: 'WORKFLOW_ACTOR_MISMATCH',
        message: `当前角色不能处理“${step.name}”`,
      });
    }
    if (instance.steps.some((item) => item.status === '已通过' && item.actorId === actor.actorId)) {
      throw new ConflictException({
        code: 'WORKFLOW_DUAL_CONTROL_REQUIRED',
        message: '同一账号不能连续完成多个会签节点',
      });
    }
    const updatedAt = this.now().toISOString();
    const isLast = instance.steps.every((item) => item.id === step.id || item.status === '已通过');
    return this.mutate(instance, expectedVersion, {
      status: status === '已驳回' ? '已驳回' : isLast ? '已通过' : undefined,
      step: {
        ...step,
        status,
        actorId: actor.actorId,
        actorName: actor.actorName,
        opinion: opinion.trim() || undefined,
        actedAt: updatedAt,
      },
      updatedAt,
    });
  }

  private ensureActive(instance: WorkflowInstance) {
    if (instance.status !== '进行中')
      throw new ConflictException({
        code: 'WORKFLOW_STATE_CONFLICT',
        message: `流程状态“${instance.status}”不可继续处理`,
      });
  }

  private async mutate(
    instance: WorkflowInstance,
    expectedVersion: number | undefined,
    mutation: Parameters<WorkflowRepository['mutate']>[1],
  ) {
    try {
      return await this.repository.mutate(
        instance.id,
        mutation,
        expectedVersion ?? instance.version,
      );
    } catch (error) {
      if (error instanceof WorkflowNotFoundError) this.throwNotFound();
      if (error instanceof WorkflowVersionConflictError)
        throw new ConflictException({
          code: 'VERSION_CONFLICT',
          message: '审批流程已被其他用户更新，请刷新后重试',
          details: { expectedVersion: error.expectedVersion, actualVersion: error.actualVersion },
        });
      throw error;
    }
  }

  private throwNotFound(): never {
    throw new NotFoundException({ code: 'WORKFLOW_NOT_FOUND', message: '审批流程不存在' });
  }
}
