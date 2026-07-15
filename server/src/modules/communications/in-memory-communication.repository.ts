import { communicationSeed } from './communication.seed';
import {
  CommunicationNotFoundError,
  type CommunicationRepository,
  CommunicationVersionConflictError,
} from './communication.repository';
import type { CommunicationDispatch, CommunicationMutation } from './communication.types';
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export class InMemoryCommunicationRepository implements CommunicationRepository {
  private records = new Map(communicationSeed.map((item) => [item.eventId, clone(item)]));
  async findAll() {
    return [...this.records.values()].map(clone);
  }
  async findByEventId(eventId: string) {
    const item = this.records.get(eventId);
    return item ? clone(item) : undefined;
  }
  async findByTaskId(taskId: string) {
    const item = [...this.records.values()].find((entry) =>
      entry.tasks.some((task) => task.id === taskId),
    );
    return item ? clone(item) : undefined;
  }
  async mutate(eventId: string, mutation: CommunicationMutation, expectedVersion: number) {
    const item = this.records.get(eventId);
    if (!item) throw new CommunicationNotFoundError();
    if (item.version !== expectedVersion) throw new CommunicationVersionConflictError();
    const next: CommunicationDispatch = { ...item, ...mutation, version: item.version + 1 };
    this.records.set(eventId, clone(next));
    return clone(next);
  }
}
