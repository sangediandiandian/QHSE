import {
  type RiskRepository,
  RiskAssessmentNotFoundError,
  RiskAssessmentPendingError,
  RiskAssessmentStateConflictError,
  RiskNotFoundError,
  RiskVersionConflictError,
} from './risk.repository';
import { riskSeed } from './risk.seed';
import type {
  RiskAssessment,
  RiskAssessmentReview,
  RiskControl,
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
      .filter(
        (item) =>
          !keyword ||
          [item.code, item.name, item.owner, item.areaName].some((value) =>
            value.toLocaleLowerCase().includes(keyword),
          ),
      )
      .map(clone);
  }

  async findById(id: string, allowedAreaIds?: string[]) {
    const risk = this.records.get(id);
    return risk && (!allowedAreaIds || allowedAreaIds.includes(risk.areaId))
      ? clone(risk)
      : undefined;
  }

  async addAssessment(
    id: string,
    assessment: RiskAssessment,
    expectedVersion?: number,
    allowedAreaIds?: string[],
  ) {
    return this.update(id, expectedVersion, allowedAreaIds, (risk) => {
      if (risk.assessments.some((item) => item.status === 'pending')) {
        throw new RiskAssessmentPendingError();
      }
      return {
        ...risk,
        assessments: [...risk.assessments, assessment],
        updatedAt: assessment.assessedAt,
      };
    });
  }

  async reviewAssessment(
    id: string,
    assessmentId: string,
    review: RiskAssessmentReview,
    expectedVersion?: number,
    allowedAreaIds?: string[],
  ) {
    return this.update(id, expectedVersion, allowedAreaIds, (risk) => {
      const index = risk.assessments.findIndex((item) => item.id === assessmentId);
      if (index < 0) throw new RiskAssessmentNotFoundError();
      const assessment = risk.assessments[index];
      if (assessment.status !== 'pending') throw new RiskAssessmentStateConflictError();
      const assessments = [...risk.assessments];
      assessments[index] = {
        ...assessment,
        status: review.decision === 'approve' ? 'approved' : 'rejected',
        reviewerId: review.reviewerId,
        reviewer: review.reviewer,
        reviewedAt: review.reviewedAt,
        opinion: review.opinion,
      };
      return {
        ...risk,
        currentLevel: review.decision === 'approve' ? assessment.level : risk.currentLevel,
        assessments,
        updatedAt: review.reviewedAt,
      };
    });
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
