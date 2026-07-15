import { emergencyPlanSeed } from './emergency-plan.seed';
import {
  EmergencyPlanNotFoundError,
  type EmergencyPlanRepository,
  EmergencyPlanVersionConflictError,
} from './emergency-plan.repository';
import type { EmergencyPlan, EmergencyPlanMutation } from './emergency-plan.types';
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export class InMemoryEmergencyPlanRepository implements EmergencyPlanRepository {
  private records = new Map(emergencyPlanSeed.map((item) => [item.id, clone(item)]));
  async findAll() {
    return [...this.records.values()].map(clone);
  }
  async findById(id: string) {
    const item = this.records.get(id);
    return item ? clone(item) : undefined;
  }
  async findByCode(code: string) {
    const item = [...this.records.values()].find((plan) => plan.code === code);
    return item ? clone(item) : undefined;
  }
  async create(plan: EmergencyPlan) {
    this.records.set(plan.id, clone(plan));
    return clone(plan);
  }
  async mutate(id: string, mutation: EmergencyPlanMutation, expected: number) {
    const item = this.records.get(id);
    if (!item) throw new EmergencyPlanNotFoundError();
    if (item.revision !== expected)
      throw new EmergencyPlanVersionConflictError(expected, item.revision);
    const next: EmergencyPlan = {
      ...item,
      ...(mutation.config ?? {}),
      draft: mutation.clearDraft ? undefined : (mutation.draft ?? item.draft),
      publishStatus: mutation.publishStatus ?? item.publishStatus,
      status: mutation.status ?? item.status,
      version: mutation.version ?? item.version,
      versions: mutation.versionRecord ? [...item.versions, mutation.versionRecord] : item.versions,
      reviewSteps: mutation.clearReviewSteps
        ? undefined
        : (mutation.reviewSteps ?? item.reviewSteps),
      workflowId: mutation.workflowId ?? item.workflowId,
      drills: mutation.drills ?? (mutation.drill ? [...item.drills, mutation.drill] : item.drills),
      revision: item.revision + 1,
      updatedAt: mutation.updatedAt,
    };
    this.records.set(id, clone(next));
    return clone(next);
  }
}
