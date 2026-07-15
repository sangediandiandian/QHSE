import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { IamService } from '../iam/iam.service';
import type { WorkflowActor, WorkflowService } from '../workflows/workflow.service';
import type {
  AddEmergencyEvidenceDto,
  ApproveEmergencyClosureDto,
  CreateEmergencyEventDto,
  EventVersionDto,
  TransitionEmergencyEventDto,
} from './emergency-event.dto';
import {
  EmergencyEventNotFoundError,
  type EmergencyEventRepository,
  EmergencyEventVersionConflictError,
} from './emergency-event.repository';
import type {
  EmergencyEvent,
  EmergencyEventAction,
  EmergencyEventMutation,
  EmergencyEventQuery,
  EmergencyEventStatus,
  EmergencyResponseLevel,
} from './emergency-event.types';

export interface EmergencyAccess extends WorkflowActor {
  allowedAreaIds?: string[];
}
interface Options {
  now?: () => Date;
  createId?: () => string;
  createCode?: (date: Date) => string;
}
const levels: EmergencyResponseLevel[] = ['IV级', 'III级', 'II级', 'I级'];
const detail: Record<EmergencyEventAction, string> = {
  研判启动: '研判确认事件需要应急响应，已启动现场处置。',
  升级响应: '根据影响范围和现场反馈提升应急响应等级。',
  降级响应: '风险影响范围缩小，应急响应等级下调。',
  终止响应: '现场风险已受控，终止应急响应并进入持续监控。',
  申请关闭: '监测数据稳定且关键任务完成，已提交关闭审批。',
  审批关闭: '关闭审批通过，事件资料和操作记录已归档。',
};

export class EmergencyEventService {
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly createCode: (date: Date) => string;

  constructor(
    private readonly repository: EmergencyEventRepository,
    private readonly workflows: WorkflowService,
    private readonly iam: IamService,
    options: Options = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
    this.createCode =
      options.createCode ??
      ((date) =>
        `EC${date.toISOString().slice(0, 10).replace(/-/g, '')}${String(date.getTime()).slice(-5)}`);
  }

  list(query: EmergencyEventQuery, allowedAreaIds?: string[]) {
    return this.repository.findAll({ ...query, areaIds: allowedAreaIds });
  }
  async get(id: string, allowedAreaIds?: string[]) {
    const event = await this.repository.findById(id, allowedAreaIds);
    if (!event) this.notFound();
    return event;
  }

  async create(input: CreateEmergencyEventDto, access: EmergencyAccess) {
    if (await this.repository.findByEventId(input.eventId))
      throw new ConflictException({
        code: 'EMERGENCY_EVENT_EXISTS',
        message: '该告警已生成应急事件',
      });
    const area = this.iam
      .listOrganizations()
      .flatMap((item) => item.areas)
      .find((item) => item.id === input.areaId);
    if (!area || (access.allowedAreaIds && !access.allowedAreaIds.includes(area.id)))
      this.notFound();
    const organization = this.iam
      .listOrganizations()
      .find((item) => item.id === area.organizationId);
    const now = this.now();
    const timestamp = now.toISOString();
    const id = this.createId();
    const event: EmergencyEvent = {
      id,
      eventId: input.eventId,
      code: this.createCode(now),
      title: input.title.trim(),
      areaId: area.id,
      areaName: area.name,
      source: input.source,
      status: '待研判',
      responseLevel: input.responseLevel,
      commander: '待指定',
      ownerDepartment: organization?.name ?? area.name,
      startedAt: timestamp,
      updatedAt: timestamp,
      createdAt: timestamp,
      summary: input.summary.trim(),
      evidence: [],
      version: 1,
      operations: [
        this.operation(
          id,
          '事件生成',
          access,
          timestamp,
          '待研判',
          input.responseLevel,
          `预警 ${input.eventId} 已转为应急事件。`,
        ),
      ],
    };
    return this.repository.create(event);
  }

  async transition(id: string, input: TransitionEmergencyEventDto, access: EmergencyAccess) {
    const event = await this.get(id, access.allowedAreaIds);
    const next = nextState(event, input.action);
    if (!next) this.stateConflict(event, input.action);
    const timestamp = this.now().toISOString();
    return this.mutate(event, input.expectedVersion, access, {
      status: next.status,
      responseLevel: next.level,
      commander: input.action === '研判启动' ? access.actorName : undefined,
      operation: this.operation(
        event.id,
        input.action,
        access,
        timestamp,
        next.status,
        next.level,
        detail[input.action],
        event,
      ),
      updatedAt: timestamp,
    });
  }

  async addEvidence(id: string, input: AddEmergencyEvidenceDto, access: EmergencyAccess) {
    const event = await this.get(id, access.allowedAreaIds);
    if (event.status === '已关闭') this.stateConflict(event, '添加证据');
    const timestamp = this.now().toISOString();
    return this.mutate(event, input.expectedVersion, access, {
      evidence: {
        id: this.createId(),
        name: input.name.trim(),
        category: input.category,
        uploaderId: access.actorId,
        uploader: access.actorName,
        uploadedAt: timestamp,
        note: input.note.trim(),
        hash:
          input.hash?.trim() ||
          createHash('sha256').update(`${event.id}:${input.name}:${timestamp}`).digest('hex'),
      },
      updatedAt: timestamp,
    });
  }

  async requestClose(id: string, input: EventVersionDto, access: EmergencyAccess) {
    const event = await this.get(id, access.allowedAreaIds);
    if (event.status !== '监控中') this.stateConflict(event, '申请关闭');
    const workflow = await this.workflows.create(
      {
        businessType: 'emergency_event_closure',
        businessId: event.id,
        title: `${event.code} 事件关闭审批`,
        steps: [{ name: 'QHSE 关闭审批', allowedRoleCodes: ['qhse_manager'] }],
      },
      access,
    );
    const timestamp = this.now().toISOString();
    const dueAt = new Date(this.now().getTime() + 4 * 60 * 60 * 1000).toISOString();
    return this.mutate(event, input.expectedVersion, access, {
      status: '待关闭',
      closureWorkflowId: workflow.id,
      closureApproval: {
        id: `${event.id}-closure`,
        workflowId: workflow.id,
        workflowVersion: workflow.version,
        type: '事件关闭',
        applicantId: access.actorId,
        applicant: access.actorName,
        assignee: 'QHSE 管理部',
        status: '待审批',
        createdAt: timestamp,
        dueAt,
        reminderCount: 0,
      },
      operation: this.operation(
        event.id,
        '申请关闭',
        access,
        timestamp,
        '待关闭',
        event.responseLevel,
        detail.申请关闭,
        event,
      ),
      updatedAt: timestamp,
    });
  }

  async remind(id: string, input: EventVersionDto, access: EmergencyAccess) {
    const event = await this.get(id, access.allowedAreaIds);
    const approval = event.closureApproval;
    if (event.status !== '待关闭' || !approval || approval.status !== '待审批')
      this.stateConflict(event, '审批催办');
    const timestamp = this.now().toISOString();
    return this.mutate(event, input.expectedVersion, access, {
      closureApproval: {
        ...approval,
        reminderCount: approval.reminderCount + 1,
        lastReminderAt: timestamp,
      },
      operation: this.operation(
        event.id,
        '审批催办',
        access,
        timestamp,
        event.status,
        event.responseLevel,
        '已记录关闭审批催办。',
        event,
      ),
      updatedAt: timestamp,
    });
  }

  async approveClose(id: string, input: ApproveEmergencyClosureDto, access: EmergencyAccess) {
    const event = await this.get(id, access.allowedAreaIds);
    const approval = event.closureApproval;
    if (event.status !== '待关闭' || !approval || approval.status !== '待审批')
      this.stateConflict(event, '审批关闭');
    if (!event.evidence.length)
      throw new BadRequestException({
        code: 'EMERGENCY_EVIDENCE_REQUIRED',
        message: '至少归档一项事件证据后才能审批关闭',
      });
    if (approval.applicantId === access.actorId && !access.roleCodes.includes('system_admin'))
      throw new ForbiddenException({
        code: 'EMERGENCY_DUAL_CONTROL_REQUIRED',
        message: '申请人与关闭审批人不能为同一账号',
      });
    const workflow = await this.workflows.approve(
      approval.workflowId,
      input.opinion,
      input.workflowVersion ?? approval.workflowVersion,
      access,
    );
    const timestamp = this.now().toISOString();
    return this.mutate(event, input.expectedVersion, access, {
      status: '已关闭',
      closureApproval: {
        ...approval,
        workflowVersion: workflow.version,
        status: '已通过',
        approvedAt: timestamp,
        signature: `${access.actorName}（电子签名）`,
        opinion: input.opinion.trim(),
      },
      operation: this.operation(
        event.id,
        '审批关闭',
        access,
        timestamp,
        '已关闭',
        event.responseLevel,
        detail.审批关闭,
        event,
      ),
      updatedAt: timestamp,
    });
  }

  private operation(
    id: string,
    action: EmergencyEvent['operations'][number]['action'],
    access: EmergencyAccess,
    operatedAt: string,
    toStatus: EmergencyEventStatus,
    toLevel: EmergencyResponseLevel,
    text: string,
    event?: EmergencyEvent,
  ) {
    return {
      id: this.createId(),
      action,
      operatorId: access.actorId,
      operator: access.actorName,
      operatedAt,
      fromStatus: event?.status,
      toStatus,
      fromLevel: event?.responseLevel,
      toLevel,
      detail: text,
    };
  }

  private async mutate(
    event: EmergencyEvent,
    expectedVersion: number | undefined,
    access: EmergencyAccess,
    mutation: EmergencyEventMutation,
  ) {
    try {
      return await this.repository.mutate(
        event.id,
        mutation,
        expectedVersion ?? event.version,
        access.allowedAreaIds,
      );
    } catch (error) {
      if (error instanceof EmergencyEventNotFoundError) this.notFound();
      if (error instanceof EmergencyEventVersionConflictError)
        throw new ConflictException({
          code: 'VERSION_CONFLICT',
          message: '事件已被其他用户更新，请刷新后重试',
          details: { expectedVersion: error.expectedVersion, actualVersion: error.actualVersion },
        });
      throw error;
    }
  }
  private stateConflict(event: EmergencyEvent, action: string): never {
    throw new ConflictException({
      code: 'EMERGENCY_STATE_CONFLICT',
      message: `事件状态“${event.status}”不能执行“${action}”`,
    });
  }
  private notFound(): never {
    throw new NotFoundException({ code: 'EMERGENCY_EVENT_NOT_FOUND', message: '应急事件不存在' });
  }
}

function nextState(event: EmergencyEvent, action: TransitionEmergencyEventDto['action']) {
  const index = levels.indexOf(event.responseLevel);
  if (action === '研判启动' && event.status === '待研判')
    return { status: '响应中' as const, level: event.responseLevel };
  if (action === '升级响应' && event.status === '响应中' && index < levels.length - 1)
    return { status: event.status, level: levels[index + 1] };
  if (action === '降级响应' && event.status === '响应中' && index > 0)
    return { status: event.status, level: levels[index - 1] };
  if (action === '终止响应' && event.status === '响应中')
    return { status: '监控中' as const, level: event.responseLevel };
  return undefined;
}
