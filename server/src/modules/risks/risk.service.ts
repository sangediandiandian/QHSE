import { ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { CreateRiskAssessmentDto } from './dto/create-risk-assessment.dto';
import type { UpdateRiskControlsDto } from './dto/update-risk-controls.dto';
import {
  type RiskRepository,
  RiskAssessmentNotFoundError,
  RiskAssessmentPendingError,
  RiskAssessmentStateConflictError,
  RiskNotFoundError,
  RiskVersionConflictError,
} from './risk.repository';
import type { RiskLevel, RiskQuery } from './risk.types';

interface RiskServiceOptions {
  now?: () => Date;
  createId?: () => string;
}

export interface RiskAccessContext {
  actorId: string;
  actorName: string;
  allowedAreaIds?: string[];
}

export function getLecRiskLevel(score: number): RiskLevel {
  if (score >= 320) return 'critical';
  if (score >= 160) return 'high';
  if (score >= 70) return 'medium';
  return 'low';
}

export class RiskService {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(
    private readonly repository: RiskRepository,
    options: RiskServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  list(query: RiskQuery, allowedAreaIds?: string[]) {
    return this.repository.findAll({ ...query, areaIds: allowedAreaIds });
  }

  async get(id: string, allowedAreaIds?: string[]) {
    const risk = await this.repository.findById(id, allowedAreaIds);
    if (!risk) {
      throw new NotFoundException({ code: 'RISK_NOT_FOUND', message: '风险单元不存在' });
    }
    return risk;
  }

  async assess(id: string, input: CreateRiskAssessmentDto, access: RiskAccessContext) {
    const score = input.likelihood * input.exposure * input.consequence;
    const assessedAt = this.now();
    try {
      return await this.repository.addAssessment(
        id,
        {
          id: this.createId(),
          assessorId: access.actorId,
          method: 'LEC',
          likelihood: input.likelihood,
          exposure: input.exposure,
          consequence: input.consequence,
          score,
          level: getLecRiskLevel(score),
          assessor: access.actorName,
          assessedAt,
          basis: input.basis.trim(),
          status: 'pending',
        },
        input.expectedVersion,
        access.allowedAreaIds,
      );
    } catch (error) {
      this.mapRepositoryError(error);
    }
  }

  async reviewAssessment(
    id: string,
    assessmentId: string,
    input: { decision: 'approve' | 'reject'; opinion?: string; expectedVersion?: number },
    access: RiskAccessContext,
  ) {
    const risk = await this.get(id, access.allowedAreaIds);
    const assessment = risk.assessments.find((item) => item.id === assessmentId);
    if (!assessment) {
      throw new NotFoundException({
        code: 'RISK_ASSESSMENT_NOT_FOUND',
        message: '风险评估记录不存在',
      });
    }
    if (assessment.assessorId === access.actorId) {
      throw new ConflictException({
        code: 'RISK_DUAL_CONTROL_REQUIRED',
        message: '评估人与审批人必须为不同账号',
      });
    }
    if (input.decision === 'reject' && !input.opinion?.trim()) {
      throw new ConflictException({
        code: 'RISK_REVIEW_OPINION_REQUIRED',
        message: '驳回风险评估时必须填写意见',
      });
    }
    try {
      return await this.repository.reviewAssessment(
        id,
        assessmentId,
        {
          decision: input.decision,
          reviewerId: access.actorId,
          reviewer: access.actorName,
          reviewedAt: this.now(),
          opinion: input.opinion?.trim() || undefined,
        },
        input.expectedVersion,
        access.allowedAreaIds,
      );
    } catch (error) {
      this.mapRepositoryError(error);
    }
  }

  async saveControls(id: string, input: UpdateRiskControlsDto, access: RiskAccessContext) {
    const updatedAt = this.now();
    try {
      return await this.repository.replaceControls(
        id,
        input.controls.map((item, index) => ({
          id: `${id}-control-${index + 1}`,
          content: item.content.trim(),
          owner: item.owner.trim(),
          status: item.status,
          updatedAt,
        })),
        input.expectedVersion,
        access.allowedAreaIds,
      );
    } catch (error) {
      this.mapRepositoryError(error);
    }
  }

  private mapRepositoryError(error: unknown): never {
    if (error instanceof RiskNotFoundError) {
      throw new NotFoundException({ code: 'RISK_NOT_FOUND', message: '风险单元不存在' });
    }
    if (error instanceof RiskVersionConflictError) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: '风险数据已被其他用户更新，请刷新后重试',
        details: {
          expectedVersion: error.expectedVersion,
          actualVersion: error.actualVersion,
        },
      });
    }
    if (error instanceof RiskAssessmentNotFoundError) {
      throw new NotFoundException({
        code: 'RISK_ASSESSMENT_NOT_FOUND',
        message: '风险评估记录不存在',
      });
    }
    if (error instanceof RiskAssessmentPendingError) {
      throw new ConflictException({
        code: 'RISK_ASSESSMENT_ALREADY_PENDING',
        message: '该风险单元已有待审批评估',
      });
    }
    if (error instanceof RiskAssessmentStateConflictError) {
      throw new ConflictException({
        code: 'RISK_ASSESSMENT_STATE_CONFLICT',
        message: '该风险评估已完成审批',
      });
    }
    throw error;
  }
}
