import { workPermitSeed } from './work-permit.seed';
import {
  type WorkPermitRepository,
  WorkPermitNotFoundError,
  WorkPermitVersionConflictError,
} from './work-permit.repository';
import type { WorkPermit, WorkPermitMutation, WorkPermitQuery } from './work-permit.types';

const clone = <T>(value: T): T => structuredClone(value);

export class InMemoryWorkPermitRepository implements WorkPermitRepository {
  private readonly records = new Map(workPermitSeed.map((item) => [item.id, clone(item)]));

  async findAll(query: WorkPermitQuery) {
    const keyword = query.keyword?.trim().toLocaleLowerCase();
    return [...this.records.values()]
      .filter((item) => !query.areaId || item.areaId === query.areaId)
      .filter((item) => !query.areaIds || query.areaIds.includes(item.areaId))
      .filter((item) => !query.status || item.status === query.status)
      .filter((item) => !query.type || item.type === query.type)
      .filter((item) => !query.riskLevel || item.riskLevel === query.riskLevel)
      .filter(
        (item) =>
          !keyword ||
          [item.code, item.workContent, item.areaName, item.applicant, item.guardian].some(
            (value) => value.toLocaleLowerCase().includes(keyword),
          ),
      )
      .map(clone);
  }

  async findById(id: string, allowedAreaIds?: string[]) {
    const item = this.records.get(id);
    return item && (!allowedAreaIds || allowedAreaIds.includes(item.areaId))
      ? clone(item)
      : undefined;
  }

  async create(permit: WorkPermit) {
    this.records.set(permit.id, clone(permit));
    return clone(permit);
  }

  async mutate(
    id: string,
    mutation: WorkPermitMutation,
    expectedVersion: number,
    allowedAreaIds?: string[],
  ) {
    const item = this.records.get(id);
    if (!item || (allowedAreaIds && !allowedAreaIds.includes(item.areaId)))
      throw new WorkPermitNotFoundError();
    if (item.version !== expectedVersion)
      throw new WorkPermitVersionConflictError(expectedVersion, item.version);
    const approvalSteps = mutation.approval
      ? item.approvalSteps.map((step) =>
          step.id === mutation.approval!.id ? mutation.approval! : step,
        )
      : item.approvalSteps;
    const next = {
      ...item,
      status: mutation.status ?? item.status,
      gasTest: mutation.gasTest ?? item.gasTest,
      alertReason:
        mutation.alertReason === null ? undefined : (mutation.alertReason ?? item.alertReason),
      approvalSteps,
      siteConfirmations: mutation.confirmation
        ? [...item.siteConfirmations, mutation.confirmation]
        : item.siteConfirmations,
      version: item.version + 1,
      updatedAt: mutation.updatedAt,
    };
    this.records.set(id, clone(next));
    return clone(next);
  }
}
