import type { WorkPermit, WorkPermitMutation, WorkPermitQuery } from './work-permit.types';

export const WORK_PERMIT_REPOSITORY = Symbol('WORK_PERMIT_REPOSITORY');
export class WorkPermitNotFoundError extends Error {}
export class WorkPermitVersionConflictError extends Error {
  constructor(
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
  ) {
    super('Work permit version conflict');
  }
}

export interface WorkPermitRepository {
  findAll(query: WorkPermitQuery): Promise<WorkPermit[]>;
  findById(id: string, allowedAreaIds?: string[]): Promise<WorkPermit | undefined>;
  create(permit: WorkPermit): Promise<WorkPermit>;
  mutate(
    id: string,
    mutation: WorkPermitMutation,
    expectedVersion: number,
    allowedAreaIds?: string[],
  ): Promise<WorkPermit>;
}
