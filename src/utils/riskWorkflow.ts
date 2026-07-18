import type { RiskAssessmentInput, RiskControlRecord, RiskLevel, RiskUnit } from '@/types/qhse';

export function getLecRiskLevel(score: number): RiskLevel {
  if (score >= 320) return 'critical';
  if (score >= 160) return 'high';
  if (score >= 70) return 'medium';
  return 'low';
}

export function assessRiskUnit(
  unit: RiskUnit,
  input: RiskAssessmentInput,
  id: string,
  assessedAt: string,
): RiskUnit {
  const score = input.likelihood * input.exposure * input.consequence;
  const level = getLecRiskLevel(score);
  return {
    ...unit,
    assessments: [
      ...(unit.assessments ?? []),
      {
        id,
        method: 'LEC',
        ...input,
        score,
        level,
        assessedAt,
        status: 'pending',
      },
    ],
  };
}

export function reviewRiskAssessment(
  unit: RiskUnit,
  assessmentId: string,
  decision: 'approve' | 'reject',
  reviewer: string,
  opinion: string,
  reviewedAt: string,
): RiskUnit {
  const target = unit.assessments?.find((item) => item.id === assessmentId);
  if (!target || target.status !== 'pending') return unit;
  return {
    ...unit,
    currentLevel: decision === 'approve' ? target.level : unit.currentLevel,
    assessments: unit.assessments?.map((item) =>
      item.id === assessmentId
        ? {
            ...item,
            status: decision === 'approve' ? 'approved' : 'rejected',
            reviewer,
            reviewedAt,
            opinion: opinion.trim() || undefined,
          }
        : item,
    ),
  };
}

export function saveRiskControls(
  unit: RiskUnit,
  controls: Array<Pick<RiskControlRecord, 'content' | 'owner' | 'status'>>,
  updatedAt: string,
): RiskUnit {
  const valid = controls.filter((item) => item.content.trim());
  return {
    ...unit,
    controls: valid.map((item) => item.content.trim()),
    controlRecords: valid.map((item, index) => ({
      ...item,
      id: `${unit.id}-control-${index + 1}`,
      content: item.content.trim(),
      updatedAt,
    })),
  };
}
