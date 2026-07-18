import type { EventReview } from './event-review.types';

export const EVENT_REVIEW_REPOSITORY = Symbol('EVENT_REVIEW_REPOSITORY');
export class EventReviewNotFoundError extends Error {}
export class EventReviewVersionConflictError extends Error {
  constructor(
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
  ) {
    super('Event review version conflict');
  }
}

export interface EventReviewRepository {
  findAll(allowedAreaIds?: string[]): Promise<EventReview[]>;
  findById(id: string, allowedAreaIds?: string[]): Promise<EventReview | undefined>;
  findByEventId(eventId: string): Promise<EventReview | undefined>;
  create(review: EventReview): Promise<EventReview>;
  update(
    review: EventReview,
    expectedVersion: number,
    allowedAreaIds?: string[],
  ): Promise<EventReview>;
}
