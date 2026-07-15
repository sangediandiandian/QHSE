import type { WorkflowInstance, WorkflowMutation } from './workflow.types';

export const WORKFLOW_REPOSITORY = Symbol('WORKFLOW_REPOSITORY');
export class WorkflowNotFoundError extends Error {}
export class WorkflowVersionConflictError extends Error {
  constructor(
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
  ) {
    super('Workflow version conflict');
  }
}

export interface WorkflowRepository {
  findById(id: string): Promise<WorkflowInstance | undefined>;
  findByBusiness(businessType: string, businessId: string): Promise<WorkflowInstance | undefined>;
  create(instance: WorkflowInstance): Promise<WorkflowInstance>;
  mutate(
    id: string,
    mutation: WorkflowMutation,
    expectedVersion: number,
  ): Promise<WorkflowInstance>;
}
