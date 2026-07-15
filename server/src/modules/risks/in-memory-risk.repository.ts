import {
  type RiskRepository,
  RiskNotFoundError,
  RiskVersionConflictError,
} from './risk.repository';
import { riskSeed } from './risk.seed';
import type {
  RiskAssessment,
  RiskControl,
  RiskLevel,
  RiskQuery,
  RiskUnit,
} from './risk.types';

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryRiskRepository implements RiskRepository {
  private readonly records = new Map(riskSeed.map((item) => [item.id, clone(item)]));

  async findAll(query: RiskQuery) {
    const keyword = query.keyword?.trim().toLocaleLowerCase();
    return [...this.records.values()]
      .filter((item) => !query.areaId || item.areaId === query.areaId)
      .filter((item) => !query.areaIds || query.areaIds.includes(item.areaId))
      .filter((item) => !query.level || item.currentLevel === query.level)
      .filter((item) => !keyword || [item.code, item.name, item.owner, item.areaName]
        .some((value) => value.toLocaleLowerCase().includes(keyword)))
      .map(clone);
  }

  async findById(id: string, allowedAreaIds?: string[]) {
    const risk = this.records.get(id);
    return risk && (!allowedAreaIds || allowedAreaIds.includes(risk.areaId)) ? clone(risk) : undefined;
  }

  async addAssessment(
    id: string,
    assessment: RiskAssessment,
    nextLevel: RiskLevel,
    expectedVersion?: number,
    allowedAreaIds?: string[],
  ) {
    return this.update(id, expectedVersion, allowedAreaIds, (risk) => ({
      ...risk,
      currentLevel: nextLevel,
      assessments: [...risk.assessments, assessment],
      updatedAt: assessment.assessedAt,
    }));
  }

  async replaceControls(
    id: string,
    controls: RiskControl[],
    expectedVersion?: number,
    allowedAreaIds?: string[],
  ) {
    return this.update(id, expectedVersion, allowedAreaIds, (risk) => ({
      ...risk,
      controls: controls.map((item) => item.content),
      controlRecords: controls,
      updatedAt: controls[0].updatedAt,
    }));
  }

  private update(
    id: string,
    expectedVersion: number | undefined,
    allowedAreaIds: string[] | undefined,
    updater: (risk: RiskUnit) => RiskUnit,
  ) {
    const risk = this.records.get(id);
    if (!risk || (allowedAreaIds && !allowedAreaIds.includes(risk.areaId))) {
      throw new RiskNotFoundError();
    }
    if (expectedVersion !== undefined && expectedVersion !== risk.version) {
      throw new RiskVersionConflictError(expectedVersion, risk.version);
    }
    const next = { ...updater(clone(risk)), version: risk.version + 1 };
    this.records.set(id, clone(next));
    return clone(next);
  }
}
