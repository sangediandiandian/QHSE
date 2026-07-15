import {
  type WorkflowRepository,
  WorkflowNotFoundError,
  WorkflowVersionConflictError,
} from './workflow.repository';
import type { WorkflowInstance, WorkflowMutation } from './workflow.types';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class InMemoryWorkflowRepository implements WorkflowRepository {
  private readonly records = new Map<string, WorkflowInstance>();

  async findById(id: string) {
    const item = this.records.get(id);
    return item ? clone(item) : undefined;
  }

  async findByBusiness(businessType: string, businessId: string) {
    const item = [...this.records.values()].find(
      (record) => record.businessType === businessType && record.businessId === businessId,
    );
    return item ? clone(item) : undefined;
  }

  async create(instance: WorkflowInstance) {
    this.records.set(instance.id, clone(instance));
    return clone(instance);
  }

  async mutate(id: string, mutation: WorkflowMutation, expectedVersion: number) {
    const item = this.records.get(id);
    if (!item) throw new WorkflowNotFoundError();
    if (item.version !== expectedVersion)
      throw new WorkflowVersionConflictError(expectedVersion, item.version);
    const next = {
      ...item,
      status: mutation.status ?? item.status,
      steps: mutation.step
        ? item.steps.map((step) => (step.id === mutation.step!.id ? mutation.step! : step))
        : item.steps,
      version: item.version + 1,
      updatedAt: mutation.updatedAt,
    };
    this.records.set(id, clone(next));
    return clone(next);
  }
}
