import type { RiskAssessmentInput, RiskControlRecord, RiskUnit } from '@/types/qhse';
import { request } from '@umijs/max';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  requestId: string;
  timestamp: string;
}

export async function assessRiskUnit(
  id: string,
  input: RiskAssessmentInput,
  expectedVersion: number,
) {
  const response = await request<ApiResponse<RiskUnit>>(`/api/v1/risks/${id}/assessments`, {
    method: 'POST',
    data: {
      likelihood: input.likelihood,
      exposure: input.exposure,
      consequence: input.consequence,
      basis: input.basis,
      expectedVersion,
    },
  });
  return response.data;
}

export async function reviewRiskAssessment(
  id: string,
  assessmentId: string,
  decision: 'approve' | 'reject',
  opinion: string,
  expectedVersion: number,
) {
  const response = await request<ApiResponse<RiskUnit>>(
    `/api/v1/risks/${id}/assessments/${assessmentId}/review`,
    {
      method: 'PUT',
      data: { decision, opinion, expectedVersion },
    },
  );
  return response.data;
}

export async function saveRiskControls(
  id: string,
  controls: Array<Pick<RiskControlRecord, 'content' | 'owner' | 'status'>>,
  expectedVersion: number,
) {
  const response = await request<ApiResponse<RiskUnit>>(`/api/v1/risks/${id}/controls`, {
    method: 'PUT',
    data: { controls, expectedVersion },
  });
  return response.data;
}
