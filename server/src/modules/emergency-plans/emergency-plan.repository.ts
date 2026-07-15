import type { EmergencyPlan, EmergencyPlanMutation } from './emergency-plan.types';
export const EMERGENCY_PLAN_REPOSITORY = Symbol('EMERGENCY_PLAN_REPOSITORY');
export class EmergencyPlanNotFoundError extends Error {}
export class EmergencyPlanVersionConflictError extends Error {
  constructor(
    public expected: number,
    public actual: number,
  ) {
    super('Emergency plan revision conflict');
  }
}
export interface EmergencyPlanRepository {
  findAll(): Promise<EmergencyPlan[]>;
  findById(id: string): Promise<EmergencyPlan | undefined>;
  findByCode(code: string): Promise<EmergencyPlan | undefined>;
  create(plan: EmergencyPlan): Promise<EmergencyPlan>;
  mutate(
    id: string,
    mutation: EmergencyPlanMutation,
    expectedRevision: number,
  ): Promise<EmergencyPlan>;
}
