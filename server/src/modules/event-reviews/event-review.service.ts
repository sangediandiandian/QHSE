import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AttachmentService } from '../attachments/attachment.service';
import type { EmergencyEvent } from '../emergency-events/emergency-event.types';
import type { HazardService } from '../hazards/hazard.service';
import type { HazardStatus } from '../hazards/hazard.types';
import type {
  AddEventReviewEvidenceDto,
  LinkReviewActionHazardDto,
  SaveEventReviewActionDto,
  UpdateEventReviewAnalysisDto,
} from './event-review.dto';
import {
  EventReviewNotFoundError,
  type EventReviewRepository,
  EventReviewVersionConflictError,
} from './event-review.repository';
import type { EventReviewAccess } from './event-review.types';

export class EventReviewService {
  constructor(
    private readonly repository: EventReviewRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = randomUUID,
    private readonly attachments?: AttachmentService,
    private readonly hazards?: HazardService,
  ) {}

  list(allowedAreaIds?: string[]) {
    return this.repository.findAll(allowedAreaIds);
  }

  async get(id: string, allowedAreaIds?: string[]) {
    const review = await this.repository.findById(id, allowedAreaIds);
    if (!review) this.notFound();
    return review;
  }

  async ensureForEmergencyEvent(event: EmergencyEvent, access: EventReviewAccess) {
    const existing = await this.repository.findByEventId(event.eventId);
    if (existing) return existing;
    if (event.status !== '已关闭')
      throw new ConflictException({
        code: 'EVENT_REVIEW_EVENT_NOT_CLOSED',
        message: '应急事件关闭后才能生成复盘档案',
      });
    if (access.allowedAreaIds && !access.allowedAreaIds.includes(event.areaId)) this.notFound();
    const timestamp = this.now().toISOString();
    const actionId = this.createId();
    return this.repository.create({
      id: this.createId(),
      eventId: event.eventId,
      eventCode: event.code,
      eventTitle: event.title,
      areaId: event.areaId,
      areaName: event.areaName,
      reviewCode: `RP${event.code.replace(/^EC/, '')}`,
      status: '待关闭',
      reviewer: access.actorName,
      summary: event.summary,
      directCause: '',
      rootCause: '',
      lesson: '',
      controlledAt: event.updatedAt,
      timeline: [
        ...event.operations.map((operation) => ({
          time: operation.operatedAt.slice(11, 19),
          title: operation.action,
          detail: operation.detail,
          status: 'done' as const,
        })),
        {
          time: '--',
          title: '复盘归档',
          detail: '等待调查结论和整改措施完成',
          status: 'pending',
        },
      ],
      actions: [
        {
          id: actionId,
          title: '完成事件调查报告和经验反馈',
          ownerDepartment: event.ownerDepartment,
          owner: access.actorName,
          deadline: new Date(this.now().getTime() + 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
          priority: '重要',
          status: '待整改',
        },
      ],
      evidence: [],
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  async updateAnalysis(id: string, input: UpdateEventReviewAnalysisDto, access: EventReviewAccess) {
    const review = await this.get(id, access.allowedAreaIds);
    if (review.status === '已复盘')
      throw new ConflictException({
        code: 'EVENT_REVIEW_ALREADY_CLOSED',
        message: '已归档复盘不能修改调查结论',
      });
    const timestamp = this.now().toISOString();
    return this.update(
      {
        ...review,
        reviewer: access.actorName,
        summary: input.summary.trim(),
        directCause: input.directCause.trim(),
        rootCause: input.rootCause.trim(),
        lesson: input.lesson.trim(),
        version: review.version + 1,
        updatedAt: timestamp,
      },
      input.expectedVersion,
      access.allowedAreaIds,
    );
  }

  async addEvidence(id: string, input: AddEventReviewEvidenceDto, access: EventReviewAccess) {
    const review = await this.get(id, access.allowedAreaIds);
    this.ensureOpen(review.status);
    if (!this.attachments)
      throw new BadRequestException({
        code: 'ATTACHMENT_SERVICE_UNAVAILABLE',
        message: '附件服务不可用',
      });
    const attachment = await this.attachments.bind(
      input.objectId,
      { businessType: 'event_review', businessId: review.id, areaId: review.areaId },
      access,
    );
    const timestamp = this.now().toISOString();
    return this.update(
      {
        ...review,
        evidence: [
          ...review.evidence,
          {
            id: this.createId(),
            objectId: attachment.id,
            name: input.name.trim(),
            category: input.category,
            note: input.note.trim(),
            uploaderId: access.actorId,
            uploader: access.actorName,
            uploadedAt: timestamp,
            hash: attachment.sha256,
            contentType: attachment.contentType,
            size: attachment.size,
          },
        ],
        version: review.version + 1,
        updatedAt: timestamp,
      },
      input.expectedVersion,
      access.allowedAreaIds,
    );
  }

  async addAction(id: string, input: SaveEventReviewActionDto, access: EventReviewAccess) {
    const review = await this.get(id, access.allowedAreaIds);
    this.ensureOpen(review.status);
    const timestamp = this.now().toISOString();
    return this.update(
      {
        ...review,
        actions: [
          ...review.actions,
          {
            id: this.createId(),
            title: input.title.trim(),
            ownerDepartment: input.ownerDepartment.trim(),
            owner: input.owner.trim(),
            deadline: input.deadline.slice(0, 10),
            priority: input.priority,
            status: '待整改',
            updatedById: access.actorId,
            updatedBy: access.actorName,
            updatedAt: timestamp,
          },
        ],
        version: review.version + 1,
        updatedAt: timestamp,
      },
      input.expectedVersion,
      access.allowedAreaIds,
    );
  }

  async updateAction(
    id: string,
    actionId: string,
    input: SaveEventReviewActionDto,
    access: EventReviewAccess,
  ) {
    const review = await this.get(id, access.allowedAreaIds);
    this.ensureOpen(review.status);
    const action = review.actions.find((item) => item.id === actionId);
    if (!action)
      throw new NotFoundException({
        code: 'EVENT_REVIEW_ACTION_NOT_FOUND',
        message: '整改措施不存在',
      });
    if (action.status === '已完成')
      throw new ConflictException({
        code: 'EVENT_REVIEW_ACTION_COMPLETED',
        message: '已完成整改措施不能调整',
      });
    if (action.linkedHazardId)
      throw new ConflictException({
        code: 'EVENT_REVIEW_ACTION_LINKED',
        message: '已转为隐患的整改措施请在隐患治理中维护',
      });
    const timestamp = this.now().toISOString();
    return this.update(
      {
        ...review,
        actions: review.actions.map((item) =>
          item.id === actionId
            ? {
                ...item,
                title: input.title.trim(),
                ownerDepartment: input.ownerDepartment.trim(),
                owner: input.owner.trim(),
                deadline: input.deadline.slice(0, 10),
                priority: input.priority,
                updatedById: access.actorId,
                updatedBy: access.actorName,
                updatedAt: timestamp,
              }
            : item,
        ),
        version: review.version + 1,
        updatedAt: timestamp,
      },
      input.expectedVersion,
      access.allowedAreaIds,
    );
  }

  async advanceAction(
    id: string,
    actionId: string,
    expectedVersion: number,
    access: EventReviewAccess,
  ) {
    const review = await this.get(id, access.allowedAreaIds);
    const action = review.actions.find((item) => item.id === actionId);
    if (!action)
      throw new NotFoundException({
        code: 'EVENT_REVIEW_ACTION_NOT_FOUND',
        message: '整改措施不存在',
      });
    if (action.status === '已完成')
      throw new ConflictException({
        code: 'EVENT_REVIEW_ACTION_COMPLETED',
        message: '整改措施已经完成',
      });
    if (action.linkedHazardId)
      throw new ConflictException({
        code: 'EVENT_REVIEW_ACTION_LINKED',
        message: '已转为隐患的整改措施请同步隐患治理状态',
      });
    const timestamp = this.now().toISOString();
    return this.update(
      {
        ...review,
        actions: review.actions.map((item) =>
          item.id === action.id
            ? {
                ...item,
                status: item.status === '待整改' ? '整改中' : '已完成',
                updatedById: access.actorId,
                updatedBy: access.actorName,
                updatedAt: timestamp,
                completedAt: item.status === '整改中' ? timestamp : undefined,
              }
            : item,
        ),
        version: review.version + 1,
        updatedAt: timestamp,
      },
      expectedVersion,
      access.allowedAreaIds,
    );
  }

  async linkActionToHazard(
    id: string,
    actionId: string,
    input: LinkReviewActionHazardDto,
    access: EventReviewAccess,
  ) {
    const review = await this.get(id, access.allowedAreaIds);
    this.ensureOpen(review.status);
    const action = review.actions.find((item) => item.id === actionId);
    if (!action)
      throw new NotFoundException({
        code: 'EVENT_REVIEW_ACTION_NOT_FOUND',
        message: '整改措施不存在',
      });
    if (action.status === '已完成')
      throw new ConflictException({
        code: 'EVENT_REVIEW_ACTION_COMPLETED',
        message: '已完成整改措施无需转为隐患',
      });
    const hazards = this.requireHazards();
    if (action.linkedHazardId) {
      return {
        review,
        hazard: await hazards.get(action.linkedHazardId, access.allowedAreaIds),
      };
    }
    this.ensureExpectedVersion(review.version, input.expectedVersion);
    const timestamp = this.now().toISOString();
    const today = timestamp.slice(0, 10);
    const hazard = await hazards.create(
      {
        title: action.title,
        riskUnitId: input.riskUnitId,
        level: input.level,
        source: '复盘整改',
        category: input.category.trim(),
        ownerDepartment: action.ownerDepartment,
        owner: action.owner,
        discoveredAt: action.deadline < today ? action.deadline : today,
        deadline: action.deadline,
        description: `${review.reviewCode} 事件复盘整改：${review.rootCause || review.summary}`,
        measures: [action.title],
      },
      access,
      review.areaId,
    );
    const updated = await this.update(
      {
        ...review,
        actions: review.actions.map((item) =>
          item.id === actionId
            ? {
                ...item,
                linkedHazardId: hazard.id,
                linkedHazardCode: hazard.code,
                linkedHazardStatus: hazard.status,
                linkedAt: timestamp,
                updatedById: access.actorId,
                updatedBy: access.actorName,
                updatedAt: timestamp,
              }
            : item,
        ),
        version: review.version + 1,
        updatedAt: timestamp,
      },
      input.expectedVersion,
      access.allowedAreaIds,
    );
    return { review: updated, hazard };
  }

  async syncActionHazards(id: string, expectedVersion: number, access: EventReviewAccess) {
    const review = await this.get(id, access.allowedAreaIds);
    const linkedActions = review.actions.filter((item) => item.linkedHazardId);
    if (!linkedActions.length) return review;
    this.ensureExpectedVersion(review.version, expectedVersion);
    const hazards = this.requireHazards();
    const linkedHazards = await Promise.all(
      linkedActions.map((item) => hazards.get(item.linkedHazardId!, access.allowedAreaIds)),
    );
    const byId = new Map(linkedHazards.map((hazard) => [hazard.id, hazard]));
    const changed = linkedActions.some((action) => {
      const hazard = byId.get(action.linkedHazardId!);
      return (
        hazard &&
        (action.linkedHazardStatus !== hazard.status ||
          action.status !== this.reviewActionStatus(hazard.status))
      );
    });
    if (!changed) return review;
    const timestamp = this.now().toISOString();
    return this.update(
      {
        ...review,
        actions: review.actions.map((action) => {
          if (!action.linkedHazardId) return action;
          const hazard = byId.get(action.linkedHazardId);
          if (!hazard) return action;
          const status = this.reviewActionStatus(hazard.status);
          return {
            ...action,
            status,
            linkedHazardStatus: hazard.status,
            completedAt: status === '已完成' ? hazard.updatedAt : undefined,
            updatedById: access.actorId,
            updatedBy: access.actorName,
            updatedAt: timestamp,
          };
        }),
        version: review.version + 1,
        updatedAt: timestamp,
      },
      expectedVersion,
      access.allowedAreaIds,
    );
  }

  async close(id: string, expectedVersion: number, access: EventReviewAccess) {
    const review = await this.get(id, access.allowedAreaIds);
    if (review.status === '已复盘')
      throw new ConflictException({
        code: 'EVENT_REVIEW_ALREADY_CLOSED',
        message: '事件复盘已经归档',
      });
    if (review.actions.some((item) => item.status !== '已完成'))
      throw new BadRequestException({
        code: 'EVENT_REVIEW_ACTIONS_INCOMPLETE',
        message: '所有整改措施完成后才能关闭归档',
      });
    if (
      ![review.summary, review.directCause, review.rootCause, review.lesson].every((item) =>
        item.trim(),
      )
    )
      throw new BadRequestException({
        code: 'EVENT_REVIEW_ANALYSIS_INCOMPLETE',
        message: '事件摘要、直接原因、根本原因和经验教训填写完整后才能归档',
      });
    const timestamp = this.now().toISOString();
    return this.update(
      {
        ...review,
        status: '已复盘',
        reviewer: access.actorName,
        closedAt: timestamp,
        timeline: review.timeline.map((item) =>
          item.status === 'pending'
            ? {
                ...item,
                time: timestamp.slice(11, 19),
                detail: '关闭审批通过，复盘报告与整改证据已归档',
                status: 'done',
              }
            : item,
        ),
        version: review.version + 1,
        updatedAt: timestamp,
      },
      expectedVersion,
      access.allowedAreaIds,
    );
  }

  private async update(
    review: Awaited<ReturnType<EventReviewService['get']>>,
    expectedVersion: number,
    allowedAreaIds?: string[],
  ) {
    try {
      return await this.repository.update(review, expectedVersion, allowedAreaIds);
    } catch (error) {
      if (error instanceof EventReviewNotFoundError) this.notFound();
      if (error instanceof EventReviewVersionConflictError)
        throw new ConflictException({
          code: 'VERSION_CONFLICT',
          message: '复盘记录已被其他用户更新，请刷新后重试',
          details: {
            expectedVersion: error.expectedVersion,
            actualVersion: error.actualVersion,
          },
        });
      throw error;
    }
  }

  private ensureOpen(status: Awaited<ReturnType<EventReviewService['get']>>['status']) {
    if (status === '已复盘')
      throw new ConflictException({
        code: 'EVENT_REVIEW_ALREADY_CLOSED',
        message: '已归档复盘不能继续修改',
      });
  }

  private ensureExpectedVersion(actualVersion: number, expectedVersion: number) {
    if (actualVersion !== expectedVersion)
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: '复盘记录已被其他用户更新，请刷新后重试',
        details: { expectedVersion, actualVersion },
      });
  }

  private requireHazards() {
    if (!this.hazards)
      throw new BadRequestException({
        code: 'HAZARD_SERVICE_UNAVAILABLE',
        message: '隐患服务不可用',
      });
    return this.hazards;
  }

  private reviewActionStatus(status: HazardStatus) {
    if (status === '待整改') return '待整改' as const;
    if (status === '已关闭') return '已完成' as const;
    return '整改中' as const;
  }

  private notFound(): never {
    throw new NotFoundException({
      code: 'EVENT_REVIEW_NOT_FOUND',
      message: '事件复盘不存在',
    });
  }
}
