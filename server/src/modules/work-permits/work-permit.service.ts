import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { areas } from '../iam/iam.seed';
import type { ConfirmWorkPermitSiteDto } from './dto/confirm-site.dto';
import type { CreateWorkPermitDto } from './dto/create-work-permit.dto';
import type { RecommendWorkPermitPauseDto } from './dto/recommend-pause.dto';
import type { ResumeWorkPermitDto } from './dto/resume-work-permit.dto';
import type { WorkPermitVersionDto } from './dto/version.dto';
import {
  type WorkPermitRepository,
  WorkPermitNotFoundError,
  WorkPermitVersionConflictError,
} from './work-permit.repository';
import {
  workPermitApprovalRoles,
  type WorkPermit,
  type WorkPermitApprovalRole,
  type WorkPermitQuery,
  type WorkPermitStatus,
} from './work-permit.types';

export interface WorkPermitAccessContext {
  actorId: string;
  actorName: string;
  roleCodes: string[];
  allowedAreaIds?: string[];
}

interface WorkPermitServiceOptions {
  now?: () => Date;
  createId?: () => string;
  createCode?: (type: WorkPermit['type'], now: Date) => string;
}

export class WorkPermitService {
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly createCode: (type: WorkPermit['type'], now: Date) => string;

  constructor(
    private readonly repository: WorkPermitRepository,
    options: WorkPermitServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
    this.createCode =
      options.createCode ??
      ((type, now) =>
        `${{ 动火作业: 'DH', 受限空间: 'SX', 高处作业: 'GC', 吊装作业: 'DZ', 临时用电: 'LD' }[type]}-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(now.getTime()).slice(-5)}`);
  }

  list(query: WorkPermitQuery, allowedAreaIds?: string[]) {
    return this.repository.findAll({ ...query, areaIds: allowedAreaIds });
  }

  async get(id: string, allowedAreaIds?: string[]) {
    const permit = await this.repository.findById(id, allowedAreaIds);
    if (!permit) this.throwNotFound();
    return permit;
  }

  async create(input: CreateWorkPermitDto, access: WorkPermitAccessContext) {
    if (input.endAt <= input.startAt)
      throw new BadRequestException({
        code: 'INVALID_PERMIT_TIME_RANGE',
        message: '计划结束时间必须晚于开始时间',
      });
    if (access.allowedAreaIds && !access.allowedAreaIds.includes(input.areaId))
      this.throwNotFound();
    const area = areas.find((item) => item.id === input.areaId);
    if (!area) this.throwNotFound();
    const now = this.now();
    const timestamp = now.toISOString();
    const id = this.createId();
    return this.repository.create({
      id,
      code: this.createCode(input.type, now),
      type: input.type,
      areaId: area.id,
      areaName: area.name,
      workContent: input.workContent.trim(),
      applicantId: access.actorId,
      applicant: access.actorName,
      guardian: input.guardian.trim(),
      startAt: input.startAt,
      endAt: input.endAt,
      riskLevel: input.riskLevel,
      status: '待审批',
      gasTest: input.gasTest.trim(),
      linkedGdsCodes: input.linkedGdsCodes,
      safetyMeasures: input.safetyMeasures.map((item) => item.trim()).filter(Boolean),
      workX: input.workX,
      workY: input.workY,
      approvalSteps: workPermitApprovalRoles.map((role, index) => ({
        id: this.createId(),
        sequence: index + 1,
        role,
        approver: getPendingApprover(role),
        status: '待审批',
      })),
      siteConfirmations: [],
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  async approveNext(id: string, input: WorkPermitVersionDto, access: WorkPermitAccessContext) {
    const permit = await this.get(id, access.allowedAreaIds);
    if (permit.status !== '待审批') this.throwStateConflict(permit.status, '审批');
    const next = permit.approvalSteps.find((step) => step.status === '待审批');
    if (!next)
      throw new ConflictException({
        code: 'PERMIT_APPROVAL_COMPLETE',
        message: '三级审批已全部完成',
      });
    if (!canApprove(next.role, access.roleCodes)) {
      throw new ForbiddenException({
        code: 'PERMIT_APPROVER_MISMATCH',
        message: `当前角色不能执行“${next.role}”`,
      });
    }
    const signedAt = this.now().toISOString();
    return this.mutate(permit, input.expectedVersion, access, {
      approval: {
        ...next,
        approverId: access.actorId,
        approver: access.actorName,
        status: '已通过',
        signedAt,
        signature: `${access.actorName}（电子签名）`,
      },
      updatedAt: signedAt,
    });
  }

  async confirmSite(id: string, input: ConfirmWorkPermitSiteDto, access: WorkPermitAccessContext) {
    const permit = await this.get(id, access.allowedAreaIds);
    if (
      permit.status !== '待审批' ||
      !permit.approvalSteps.every((step) => step.status === '已通过')
    )
      this.throwStateConflict(permit.status, '现场确认');
    if (permit.siteConfirmations.some((item) => item.role === input.role)) return permit;
    if (permit.siteConfirmations.some((item) => item.confirmerId === access.actorId)) {
      throw new ConflictException({
        code: 'DUAL_CONFIRMATION_REQUIRED',
        message: '作业负责人和现场监护人必须由不同人员确认',
      });
    }
    const confirmedAt = this.now().toISOString();
    return this.mutate(permit, input.expectedVersion, access, {
      status: permit.siteConfirmations.length === 1 ? '作业中' : undefined,
      confirmation: {
        id: this.createId(),
        role: input.role,
        confirmerId: access.actorId,
        confirmer: access.actorName,
        confirmedAt,
      },
      updatedAt: confirmedAt,
    });
  }

  async recommendPause(
    id: string,
    input: RecommendWorkPermitPauseDto,
    access: WorkPermitAccessContext,
  ) {
    return this.transition(id, input.expectedVersion, access, '作业中', '建议暂停', {
      alertReason: input.reason.trim(),
    });
  }

  async pause(id: string, input: WorkPermitVersionDto, access: WorkPermitAccessContext) {
    return this.transition(id, input.expectedVersion, access, '建议暂停', '已暂停');
  }

  async resume(id: string, input: ResumeWorkPermitDto, access: WorkPermitAccessContext) {
    return this.transition(id, input.expectedVersion, access, '已暂停', '作业中', {
      gasTest: input.gasTest.trim(),
      alertReason: null,
    });
  }

  async close(id: string, input: WorkPermitVersionDto, access: WorkPermitAccessContext) {
    return this.transition(id, input.expectedVersion, access, '作业中', '已关闭', {
      alertReason: null,
    });
  }

  private async transition(
    id: string,
    expectedVersion: number | undefined,
    access: WorkPermitAccessContext,
    required: WorkPermitStatus,
    next: WorkPermitStatus,
    extra: Partial<Parameters<WorkPermitRepository['mutate']>[1]> = {},
  ) {
    const permit = await this.get(id, access.allowedAreaIds);
    if (permit.status !== required) this.throwStateConflict(permit.status, next);
    return this.mutate(permit, expectedVersion, access, {
      ...extra,
      status: next,
      updatedAt: this.now().toISOString(),
    });
  }

  private async mutate(
    permit: WorkPermit,
    expectedVersion: number | undefined,
    access: WorkPermitAccessContext,
    mutation: Parameters<WorkPermitRepository['mutate']>[1],
  ) {
    try {
      return await this.repository.mutate(
        permit.id,
        mutation,
        expectedVersion ?? permit.version,
        access.allowedAreaIds,
      );
    } catch (error) {
      if (error instanceof WorkPermitNotFoundError) this.throwNotFound();
      if (error instanceof WorkPermitVersionConflictError)
        throw new ConflictException({
          code: 'VERSION_CONFLICT',
          message: '作业票已被其他用户更新，请刷新后重试',
          details: { expectedVersion: error.expectedVersion, actualVersion: error.actualVersion },
        });
      throw error;
    }
  }

  private throwNotFound(): never {
    throw new NotFoundException({ code: 'WORK_PERMIT_NOT_FOUND', message: '作业票不存在' });
  }

  private throwStateConflict(status: WorkPermitStatus, action: string): never {
    throw new ConflictException({
      code: 'WORK_PERMIT_STATE_CONFLICT',
      message: `当前状态“${status}”不能执行“${action}”`,
    });
  }
}

function getPendingApprover(role: WorkPermitApprovalRole) {
  return role === '属地审核' ? '属地负责人' : role === 'QHSE 审核' ? 'QHSE 管理人员' : '企业负责人';
}

function canApprove(role: WorkPermitApprovalRole, roleCodes: string[]) {
  if (roleCodes.includes('system_admin')) return true;
  const allowed: Record<WorkPermitApprovalRole, string[]> = {
    属地审核: ['unit_manager', 'environment_manager'],
    'QHSE 审核': ['qhse_manager'],
    负责人批准: ['enterprise_leader', 'production_dispatcher'],
  };
  return allowed[role].some((item) => roleCodes.includes(item));
}
