import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  EventReviewNotFoundError,
  type EventReviewRepository,
  EventReviewVersionConflictError,
} from './event-review.repository';
import type { EventReview, EventReviewTimelineItem, ReviewAction } from './event-review.types';

type EventReviewRecord = Awaited<ReturnType<PrismaService['eventReview']['findFirstOrThrow']>>;

const mapRecord = (record: EventReviewRecord): EventReview => ({
  ...record,
  status: record.status as EventReview['status'],
  controlledAt: record.controlledAt.toISOString(),
  closedAt: record.closedAt?.toISOString(),
  timeline: record.timeline as unknown as EventReviewTimelineItem[],
  actions: record.actions as unknown as ReviewAction[],
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

@Injectable()
export class PrismaEventReviewRepository implements EventReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(allowedAreaIds?: string[]) {
    return (
      await this.prisma.eventReview.findMany({
        where: allowedAreaIds ? { areaId: { in: allowedAreaIds } } : undefined,
        orderBy: { updatedAt: 'desc' },
      })
    ).map(mapRecord);
  }

  async findById(id: string, allowedAreaIds?: string[]) {
    const review = await this.prisma.eventReview.findFirst({
      where: { id, ...(allowedAreaIds ? { areaId: { in: allowedAreaIds } } : {}) },
    });
    return review ? mapRecord(review) : undefined;
  }

  async update(review: EventReview, expectedVersion: number, allowedAreaIds?: string[]) {
    const result = await this.prisma.eventReview.updateMany({
      where: {
        id: review.id,
        version: expectedVersion,
        ...(allowedAreaIds ? { areaId: { in: allowedAreaIds } } : {}),
      },
      data: {
        status: review.status,
        reviewer: review.reviewer,
        closedAt: review.closedAt ? new Date(review.closedAt) : null,
        timeline: review.timeline as unknown as Prisma.InputJsonValue,
        actions: review.actions as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
        updatedAt: new Date(review.updatedAt),
      },
    });
    if (!result.count) await this.throwMutationError(review.id, expectedVersion, allowedAreaIds);
    return mapRecord(await this.prisma.eventReview.findUniqueOrThrow({ where: { id: review.id } }));
  }

  private async throwMutationError(
    id: string,
    expectedVersion: number,
    allowedAreaIds?: string[],
  ): Promise<never> {
    const current = await this.prisma.eventReview.findFirst({
      where: { id, ...(allowedAreaIds ? { areaId: { in: allowedAreaIds } } : {}) },
      select: { version: true },
    });
    if (!current) throw new EventReviewNotFoundError();
    throw new EventReviewVersionConflictError(expectedVersion, current.version);
  }
}
