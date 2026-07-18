import type {
  RiskAssessment,
  RiskAssessmentReview,
  RiskControl,
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
export class RiskAssessmentNotFoundError extends Error {}
export class RiskAssessmentPendingError extends Error {}
export class RiskAssessmentStateConflictError extends Error {}

export interface RiskRepository {
  findAll(query: RiskQuery): Promise<RiskUnit[]>;
  findById(id: string, allowedAreaIds?: string[]): Promise<RiskUnit | undefined>;
  addAssessment(
    id: string,
    assessment: RiskAssessment,
    expectedVersion?: number,
    allowedAreaIds?: string[],
  ): Promise<RiskUnit>;
  reviewAssessment(
    id: string,
    assessmentId: string,
    review: RiskAssessmentReview,
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
