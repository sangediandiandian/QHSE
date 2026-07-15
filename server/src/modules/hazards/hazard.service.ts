import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { RiskService } from '../risks/risk.service';
import type { AddHazardEvidenceDto } from './dto/add-hazard-evidence.dto';
import type { CloseHazardDto } from './dto/close-hazard.dto';
import type { CreateHazardDto } from './dto/create-hazard.dto';
import type { UpdateHazardSupervisionDto } from './dto/update-hazard-supervision.dto';
import type { VersionDto } from './dto/version.dto';
import {
  type HazardRepository,
  HazardNotFoundError,
  HazardVersionConflictError,
} from './hazard.repository';
import type { Hazard, HazardAction, HazardQuery, HazardStatus } from './hazard.types';

interface HazardServiceOptions {
  now?: () => Date;
  createId?: () => string;
  createCode?: (now: Date) => string;
}

export interface HazardAccessContext {
  actorId: string;
  actorName: string;
  allowedAreaIds?: string[];
}

export class HazardService {
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly createCode: (now: Date) => string;

  constructor(
    private readonly repository: HazardRepository,
    private readonly riskService: RiskService,
    options: HazardServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
    this.createCode =
      options.createCode ??
      ((now) => `YH${formatDate(now).replace(/-/g, '')}${String(now.getTime()).slice(-6)}`);
  }

  list(query: HazardQuery, allowedAreaIds?: string[]) {
    return this.repository.findAll({ ...query, areaIds: allowedAreaIds });
  }

  async get(id: string, allowedAreaIds?: string[]) {
    const hazard = await this.repository.findById(id, allowedAreaIds);
    if (!hazard) this.throwNotFound();
    return hazard;
  }

  async create(input: CreateHazardDto, access: HazardAccessContext) {
    this.validateDates(input.discoveredAt, input.deadline);
    const risk = await this.riskService.get(input.riskUnitId, access.allowedAreaIds);
    const now = this.now();
    const timestamp = now.toISOString();
    const id = this.createId();
    const hazard: Hazard = {
      id,
      code: this.createCode(now),
      title: input.title.trim(),
      areaId: risk.areaId,
      areaName: risk.areaName,
      level: input.level,
      source: input.source,
      category: input.category.trim(),
      ownerDepartment: input.ownerDepartment.trim(),
      owner: input.owner.trim(),
      discoveredAt: input.discoveredAt,
      deadline: input.deadline,
      status: '待整改',
      riskUnitId: input.riskUnitId,
      overdue: input.deadline < formatDate(now),
      recurrenceCount: 0,
      description: input.description.trim(),
      measures: input.measures.map((item) => item.trim()).filter(Boolean),
      supervised: input.level === '重大',
      evidence: [],
      operations: [this.operation('上报', access, timestamp, '隐患已上报并生成整改任务')],
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    if (!hazard.measures.length) {
      throw new BadRequestException({
        code: 'HAZARD_MEASURES_REQUIRED',
        message: '至少填写一项整改措施',
      });
    }
    return this.repository.create(hazard);
  }

  async addEvidence(id: string, input: AddHazardEvidenceDto, access: HazardAccessContext) {
    const hazard = await this.get(id, access.allowedAreaIds);
    if (hazard.status === '已关闭') this.throwStateConflict(hazard.status, '添加整改证据');
    const timestamp = this.now().toISOString();
    return this.runMutation(hazard, input.expectedVersion, access, {
      evidence: {
        id: this.createId(),
        name: input.name.trim(),
        category: input.category,
        uploaderId: access.actorId,
        uploader: access.actorName,
        uploadedAt: timestamp,
        note: input.note?.trim() || undefined,
      },
      updatedAt: timestamp,
    });
  }

  async start(id: string, input: VersionDto, access: HazardAccessContext) {
    return this.transition(
      id,
      input.expectedVersion,
      access,
      '待整改',
      '整改中',
      '开始整改',
      '责任人已开始整改',
    );
  }

  async submit(id: string, input: VersionDto, access: HazardAccessContext) {
    const hazard = await this.get(id, access.allowedAreaIds);
    if (hazard.status !== '整改中') this.throwStateConflict(hazard.status, '提交验收');
    if (!hazard.evidence.length) {
      throw new BadRequestException({
        code: 'HAZARD_EVIDENCE_REQUIRED',
        message: '提交验收前至少需要一条整改证据',
      });
    }
    return this.performTransition(
      hazard,
      input.expectedVersion,
      access,
      '待验收',
      '提交验收',
      '整改完成，已提交验收',
    );
  }

  async close(id: string, input: CloseHazardDto, access: HazardAccessContext) {
    const hazard = await this.get(id, access.allowedAreaIds);
    if (hazard.status !== '待验收') this.throwStateConflict(hazard.status, '验收关闭');
    const opinion = input.opinion.trim();
    if (!opinion) {
      throw new BadRequestException({
        code: 'HAZARD_ACCEPTANCE_REQUIRED',
        message: '请填写验收意见',
      });
    }
    const timestamp = this.now().toISOString();
    return this.runMutation(hazard, input.expectedVersion, access, {
      status: '已关闭',
      acceptanceOpinion: opinion,
      operation: this.operation('验收关闭', access, timestamp, `验收通过：${opinion}`),
      updatedAt: timestamp,
    });
  }

  async updateSupervision(
    id: string,
    input: UpdateHazardSupervisionDto,
    access: HazardAccessContext,
  ) {
    const hazard = await this.get(id, access.allowedAreaIds);
    if (hazard.supervised === input.supervised) return hazard;
    const timestamp = this.now().toISOString();
    const action = input.supervised ? '挂牌督办' : '解除挂牌';
    return this.runMutation(hazard, input.expectedVersion, access, {
      supervised: input.supervised,
      operation: this.operation(action, access, timestamp, action),
      updatedAt: timestamp,
    });
  }

  private async transition(
    id: string,
    expectedVersion: number | undefined,
    access: HazardAccessContext,
    requiredStatus: HazardStatus,
    nextStatus: HazardStatus,
    action: HazardAction,
    detail: string,
  ) {
    const hazard = await this.get(id, access.allowedAreaIds);
    if (hazard.status !== requiredStatus) this.throwStateConflict(hazard.status, action);
    return this.performTransition(hazard, expectedVersion, access, nextStatus, action, detail);
  }

  private performTransition(
    hazard: Hazard,
    expectedVersion: number | undefined,
    access: HazardAccessContext,
    status: HazardStatus,
    action: HazardAction,
    detail: string,
  ) {
    const timestamp = this.now().toISOString();
    return this.runMutation(hazard, expectedVersion, access, {
      status,
      operation: this.operation(action, access, timestamp, detail),
      updatedAt: timestamp,
    });
  }

  private async runMutation(
    hazard: Hazard,
    expectedVersion: number | undefined,
    access: HazardAccessContext,
    mutation: Parameters<HazardRepository['mutate']>[1],
  ) {
    try {
      return await this.repository.mutate(
        hazard.id,
        mutation,
        expectedVersion ?? hazard.version,
        access.allowedAreaIds,
      );
    } catch (error) {
      this.mapRepositoryError(error);
    }
  }

  private operation(
    action: HazardAction,
    access: HazardAccessContext,
    operatedAt: string,
    detail: string,
  ) {
    return {
      id: this.createId(),
      action,
      operatorId: access.actorId,
      operator: access.actorName,
      operatedAt,
      detail,
    };
  }

  private validateDates(discoveredAt: string, deadline: string) {
    if (!isDateOnly(discoveredAt) || !isDateOnly(deadline) || deadline < discoveredAt) {
      throw new BadRequestException({
        code: 'INVALID_HAZARD_DATE_RANGE',
        message: '整改期限不能早于发现日期',
      });
    }
  }

  private throwNotFound(): never {
    throw new NotFoundException({ code: 'HAZARD_NOT_FOUND', message: '隐患不存在' });
  }

  private throwStateConflict(status: HazardStatus, action: string): never {
    throw new ConflictException({
      code: 'HAZARD_STATE_CONFLICT',
      message: `当前状态“${status}”不能执行“${action}”`,
    });
  }

  private mapRepositoryError(error: unknown): never {
    if (error instanceof HazardNotFoundError) this.throwNotFound();
    if (error instanceof HazardVersionConflictError) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: '隐患数据已被其他用户更新，请刷新后重试',
        details: {
          expectedVersion: error.expectedVersion,
          actualVersion: error.actualVersion,
        },
      });
    }
    throw error;
  }
}

function isDateOnly(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}
