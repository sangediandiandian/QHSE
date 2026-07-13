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
    currentLevel: level,
    assessments: [...(unit.assessments ?? []), {
      id,
      method: 'LEC',
      ...input,
      score,
      level,
      assessedAt,
    }],
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
