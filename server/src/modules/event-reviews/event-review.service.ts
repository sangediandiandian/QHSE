import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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
  ) {}

  list(allowedAreaIds?: string[]) {
    return this.repository.findAll(allowedAreaIds);
  }

  async get(id: string, allowedAreaIds?: string[]) {
    const review = await this.repository.findById(id, allowedAreaIds);
    if (!review) this.notFound();
    return review;
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
    const timestamp = this.now().toISOString();
    return this.update(
      {
        ...review,
        status: '已复盘',
        reviewer: access.actorName,
        closedAt: timestamp,
        timeline: review.timeline.map((item) =>
          item.title === '事件关闭'
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

  private notFound(): never {
    throw new NotFoundException({
      code: 'EVENT_REVIEW_NOT_FOUND',
      message: '事件复盘不存在',
    });
  }
}
