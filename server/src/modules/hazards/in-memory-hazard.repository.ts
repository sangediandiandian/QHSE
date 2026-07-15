import { hazardSeed } from './hazard.seed';
import {
  type HazardRepository,
  HazardNotFoundError,
  HazardVersionConflictError,
} from './hazard.repository';
import type { Hazard, HazardMutation, HazardQuery } from './hazard.types';

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryHazardRepository implements HazardRepository {
  private readonly records = new Map(hazardSeed.map((item) => [item.id, clone(item)]));

  async findAll(query: HazardQuery) {
    const keyword = query.keyword?.trim().toLocaleLowerCase();
    return [...this.records.values()]
      .map(withCurrentOverdue)
      .filter((item) => !query.areaId || item.areaId === query.areaId)
      .filter((item) => !query.areaIds || query.areaIds.includes(item.areaId))
      .filter((item) => !query.status || item.status === query.status)
      .filter((item) => !query.level || item.level === query.level)
      .filter((item) => query.overdue === undefined || item.overdue === query.overdue)
      .filter((item) => query.supervised === undefined || item.supervised === query.supervised)
      .filter(
        (item) =>
          !keyword ||
          [item.code, item.title, item.areaName, item.owner].some((value) =>
            value.toLocaleLowerCase().includes(keyword),
          ),
      )
      .map(clone);
  }

  async findById(id: string, allowedAreaIds?: string[]) {
    const item = this.records.get(id);
    return item && (!allowedAreaIds || allowedAreaIds.includes(item.areaId))
      ? clone(withCurrentOverdue(item))
      : undefined;
  }

  async create(hazard: Hazard) {
    this.records.set(hazard.id, clone(hazard));
    return clone(hazard);
  }

  async mutate(
    id: string,
    mutation: HazardMutation,
    expectedVersion: number,
    allowedAreaIds?: string[],
  ) {
    const item = this.records.get(id);
    if (!item || (allowedAreaIds && !allowedAreaIds.includes(item.areaId))) {
      throw new HazardNotFoundError();
    }
    if (item.version !== expectedVersion) {
      throw new HazardVersionConflictError(expectedVersion, item.version);
    }
    const next: Hazard = withCurrentOverdue({
      ...item,
      status: mutation.status ?? item.status,
      supervised: mutation.supervised ?? item.supervised,
      acceptanceOpinion: mutation.acceptanceOpinion ?? item.acceptanceOpinion,
      evidence: mutation.evidence ? [...item.evidence, mutation.evidence] : item.evidence,
      operations: mutation.operation ? [...item.operations, mutation.operation] : item.operations,
      updatedAt: mutation.updatedAt,
      version: item.version + 1,
    });
    this.records.set(id, clone(next));
    return clone(next);
  }
}

function withCurrentOverdue(hazard: Hazard): Hazard {
  const today = new Date().toISOString().slice(0, 10);
  return { ...hazard, overdue: hazard.status !== '已关闭' && hazard.deadline < today };
}
