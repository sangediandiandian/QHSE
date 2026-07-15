import type {
  RiskAssessment,
  RiskControl,
  RiskLevel,
  RiskQuery,
  RiskUnit,
} from './risk.types';

export const RISK_REPOSITORY = Symbol('RISK_REPOSITORY');

export class RiskNotFoundError extends Error {}
export class RiskVersionConflictError extends Error {
  constructor(
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
  ) {
    super('Risk version conflict');
  }
}

export interface RiskRepository {
  findAll(query: RiskQuery): Promise<RiskUnit[]>;
  findById(id: string, allowedAreaIds?: string[]): Promise<RiskUnit | undefined>;
  addAssessment(
    id: string,
    assessment: RiskAssessment,
    nextLevel: RiskLevel,
    expectedVersion?: number,
    allowedAreaIds?: string[],
  ): Promise<RiskUnit>;
  replaceControls(
    id: string,
    controls: RiskControl[],
    expectedVersion?: number,
    allowedAreaIds?: string[],
  ): Promise<RiskUnit>;
}
