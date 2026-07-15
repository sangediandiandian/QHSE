import type { Hazard, HazardMutation, HazardQuery } from './hazard.types';

export const HAZARD_REPOSITORY = Symbol('HAZARD_REPOSITORY');

export class HazardNotFoundError extends Error {}
export class HazardVersionConflictError extends Error {
  constructor(
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
  ) {
    super('Hazard version conflict');
  }
}

export interface HazardRepository {
  findAll(query: HazardQuery): Promise<Hazard[]>;
  findById(id: string, allowedAreaIds?: string[]): Promise<Hazard | undefined>;
  create(hazard: Hazard): Promise<Hazard>;
  mutate(
    id: string,
    mutation: HazardMutation,
    expectedVersion: number,
    allowedAreaIds?: string[],
  ): Promise<Hazard>;
}
