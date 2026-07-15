import { emergencyEventSeed } from './emergency-event.seed';
import {
  EmergencyEventNotFoundError,
  type EmergencyEventRepository,
  EmergencyEventVersionConflictError,
} from './emergency-event.repository';
import type {
  EmergencyEvent,
  EmergencyEventMutation,
  EmergencyEventQuery,
} from './emergency-event.types';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class InMemoryEmergencyEventRepository implements EmergencyEventRepository {
  private readonly records = new Map(emergencyEventSeed.map((item) => [item.id, clone(item)]));

  async findAll(query: EmergencyEventQuery) {
    const keyword = query.keyword?.trim().toLowerCase();
    return [...this.records.values()]
      .filter((item) => !query.areaId || item.areaId === query.areaId)
      .filter((item) => !query.areaIds || query.areaIds.includes(item.areaId))
      .filter((item) => !query.status || item.status === query.status)
      .filter(
        (item) =>
          !keyword ||
          [item.code, item.title, item.areaName].some((value) =>
            value.toLowerCase().includes(keyword),
          ),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(clone);
  }

  async findById(id: string, allowedAreaIds?: string[]) {
    const item = this.records.get(id);
    return item && (!allowedAreaIds || allowedAreaIds.includes(item.areaId))
      ? clone(item)
      : undefined;
  }

  async findByEventId(eventId: string) {
    const item = [...this.records.values()].find((event) => event.eventId === eventId);
    return item ? clone(item) : undefined;
  }

  async create(event: EmergencyEvent) {
    this.records.set(event.id, clone(event));
    return clone(event);
  }

  async mutate(
    id: string,
    mutation: EmergencyEventMutation,
    expectedVersion: number,
    allowedAreaIds?: string[],
  ) {
    const item = this.records.get(id);
    if (!item || (allowedAreaIds && !allowedAreaIds.includes(item.areaId)))
      throw new EmergencyEventNotFoundError();
    if (item.version !== expectedVersion)
      throw new EmergencyEventVersionConflictError(expectedVersion, item.version);
    const next: EmergencyEvent = {
      ...item,
      status: mutation.status ?? item.status,
      responseLevel: mutation.responseLevel ?? item.responseLevel,
      commander: mutation.commander ?? item.commander,
      operations: mutation.operation ? [...item.operations, mutation.operation] : item.operations,
      evidence: mutation.evidence ? [...item.evidence, mutation.evidence] : item.evidence,
      closureApproval: mutation.closureApproval ?? item.closureApproval,
      closureWorkflowId: mutation.closureWorkflowId ?? item.closureWorkflowId,
      updatedAt: mutation.updatedAt,
      version: item.version + 1,
    };
    this.records.set(id, clone(next));
    return clone(next);
  }
}
