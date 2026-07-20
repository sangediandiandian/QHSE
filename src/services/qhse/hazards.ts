import type {
  Hazard,
  HazardDuplicateCandidate,
  HazardEvidenceInput,
  HazardQuery,
  HazardReminderResult,
  HazardReportInput,
  RiskUnit,
} from '@/types/qhse';
import { request } from '@umijs/max';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  requestId: string;
  timestamp: string;
}

export async function getHazards(params?: HazardQuery) {
  const response = await request<ApiResponse<Hazard[]>>('/api/v1/hazards', { method: 'GET', params });
  return response.data;
}

export async function getHazardRiskUnits() {
  const response = await request<ApiResponse<RiskUnit[]>>('/api/v1/risks', { method: 'GET' });
  return response.data;
}

export async function reportHazard(input: HazardReportInput) {
  const response = await request<ApiResponse<Hazard>>('/api/v1/hazards', { method: 'POST', data: input });
  return response.data;
}

export async function checkHazardDuplicates(
  input: Pick<HazardReportInput, 'title' | 'riskUnitId' | 'category'>,
) {
  const response = await request<ApiResponse<HazardDuplicateCandidate[]>>(
    '/api/v1/hazards/duplicates/check',
    { method: 'POST', data: input },
  );
  return response.data;
}

export async function runHazardReminders() {
  const response = await request<ApiResponse<HazardReminderResult>>(
    '/api/v1/hazards/reminders/run',
    { method: 'POST' },
  );
  return response.data;
}

export async function addHazardEvidence(id: string, input: HazardEvidenceInput, expectedVersion: number) {
  const response = await request<ApiResponse<Hazard>>(`/api/v1/hazards/${id}/evidence`, {
    method: 'POST',
    data: { ...input, expectedVersion },
  });
  return response.data;
}

export async function startHazardRectification(id: string, expectedVersion: number) {
  const response = await request<ApiResponse<Hazard>>(`/api/v1/hazards/${id}/rectification/start`, {
    method: 'POST', data: { expectedVersion },
  });
  return response.data;
}

export async function submitHazardAcceptance(id: string, expectedVersion: number) {
  const response = await request<ApiResponse<Hazard>>(`/api/v1/hazards/${id}/acceptance/submit`, {
    method: 'POST', data: { expectedVersion },
  });
  return response.data;
}

export async function closeHazard(id: string, opinion: string, expectedVersion: number) {
  const response = await request<ApiResponse<Hazard>>(`/api/v1/hazards/${id}/acceptance/close`, {
    method: 'POST', data: { opinion, expectedVersion },
  });
  return response.data;
}

export async function setHazardSupervision(id: string, supervised: boolean, expectedVersion: number) {
  const response = await request<ApiResponse<Hazard>>(`/api/v1/hazards/${id}/supervision`, {
    method: 'PUT', data: { supervised, expectedVersion },
  });
  return response.data;
}
