import type {
  EmergencyEvent,
  EmergencyEventMutation,
  EmergencyEventQuery,
} from './emergency-event.types';

export const EMERGENCY_EVENT_REPOSITORY = Symbol('EMERGENCY_EVENT_REPOSITORY');
export class EmergencyEventNotFoundError extends Error {}
export class EmergencyEventVersionConflictError extends Error {
  constructor(
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
  ) {
    super('Emergency event version conflict');
  }
}

export interface EmergencyEventRepository {
  findAll(query: EmergencyEventQuery): Promise<EmergencyEvent[]>;
  findById(id: string, allowedAreaIds?: string[]): Promise<EmergencyEvent | undefined>;
  findByEventId(eventId: string): Promise<EmergencyEvent | undefined>;
  create(event: EmergencyEvent): Promise<EmergencyEvent>;
  mutate(
    id: string,
    mutation: EmergencyEventMutation,
    expectedVersion: number,
    allowedAreaIds?: string[],
  ): Promise<EmergencyEvent>;
}
