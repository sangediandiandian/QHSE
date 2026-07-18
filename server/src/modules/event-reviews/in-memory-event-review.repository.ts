import { eventReviewSeed } from './event-review.seed';
import {
  EventReviewNotFoundError,
  type EventReviewRepository,
  EventReviewVersionConflictError,
} from './event-review.repository';
import type { EventReview } from './event-review.types';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class InMemoryEventReviewRepository implements EventReviewRepository {
  private readonly records = new Map(eventReviewSeed.map((item) => [item.id, clone(item)]));

  async findAll(allowedAreaIds?: string[]) {
    return [...this.records.values()]
      .filter((item) => !allowedAreaIds || allowedAreaIds.includes(item.areaId))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(clone);
  }

  async findById(id: string, allowedAreaIds?: string[]) {
    const review = this.records.get(id);
    return review && (!allowedAreaIds || allowedAreaIds.includes(review.areaId))
      ? clone(review)
      : undefined;
  }

  async update(review: EventReview, expectedVersion: number, allowedAreaIds?: string[]) {
    const current = this.records.get(review.id);
    if (!current || (allowedAreaIds && !allowedAreaIds.includes(current.areaId)))
      throw new EventReviewNotFoundError();
    if (current.version !== expectedVersion)
      throw new EventReviewVersionConflictError(expectedVersion, current.version);
    this.records.set(review.id, clone(review));
    return clone(review);
  }
}
