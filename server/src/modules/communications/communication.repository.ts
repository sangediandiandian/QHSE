import type { CommunicationDispatch, CommunicationMutation } from './communication.types';
export const COMMUNICATION_REPOSITORY = Symbol('COMMUNICATION_REPOSITORY');
export class CommunicationNotFoundError extends Error {}
export class CommunicationVersionConflictError extends Error {}
export interface CommunicationRepository {
  findAll(): Promise<CommunicationDispatch[]>;
  findByEventId(eventId: string): Promise<CommunicationDispatch | undefined>;
  findByTaskId(taskId: string): Promise<CommunicationDispatch | undefined>;
  mutate(
    eventId: string,
    mutation: CommunicationMutation,
    expectedVersion: number,
  ): Promise<CommunicationDispatch>;
}
