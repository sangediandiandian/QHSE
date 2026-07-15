import type { EmergencyEvent, WarningEvaluationResult, WarningEvidenceCategory, WarningRule, WarningRuleDraftInput, WarningSampleInput, WarningSignal } from '@/types/qhse';
import { request } from '@umijs/max';

interface ApiResponse<T> { success: boolean; data: T; requestId: string; timestamp: string }

export async function getWarningRules() {
  const response = await request<ApiResponse<WarningRule[]>>('/api/v1/warning-rules', { method: 'GET' });
  return response.data;
}

export async function createWarningRuleDraft(input: WarningRuleDraftInput) {
  const response = await request<ApiResponse<WarningRule>>('/api/v1/warning-rules', { method: 'POST', data: input });
  return response.data;
}

export async function updateWarningRuleDraft(id: string, input: WarningRuleDraftInput, expectedRevision: number) {
  const response = await request<ApiResponse<WarningRule>>(`/api/v1/warning-rules/${id}/draft`, { method: 'PUT', data: { ...input, expectedRevision } });
  return response.data;
}

async function post(id: string, action: string, data: Record<string, unknown>) {
  const response = await request<ApiResponse<WarningRule>>(`/api/v1/warning-rules/${id}/${action}`, { method: 'POST', data });
  return response.data;
}

export const submitWarningRule = (id: string, expectedRevision: number) => post(id, 'submit', { expectedRevision });
export const approveWarningRule = (id: string, expectedRevision: number, opinion?: string) => post(id, 'approve', { expectedRevision, opinion });
export const rejectWarningRule = (id: string, expectedRevision: number, opinion: string) => post(id, 'reject', { expectedRevision, opinion });
export const rollbackWarningRule = (id: string, version: number, expectedRevision: number) => post(id, 'rollback', { version, expectedRevision });

export async function toggleWarningRule(id: string, enabled: boolean, expectedRevision: number) {
  const response = await request<ApiResponse<WarningRule>>(`/api/v1/warning-rules/${id}/enabled`, { method: 'PUT', data: { enabled, expectedRevision } });
  return response.data;
}

export async function evaluateWarningSample(input: WarningSampleInput) {
  const response = await request<ApiResponse<WarningEvaluationResult>>('/api/v1/warning-execution/samples', { method: 'POST', data: input });
  return response.data;
}

export async function getWarningSignals() {
  const response = await request<ApiResponse<WarningSignal[]>>('/api/v1/warning-execution/signals', { method: 'GET', params: { limit: 100 } });
  return response.data;
}

async function signalPost(id: string, action: string, data: Record<string, unknown>) {
  const response = await request<ApiResponse<WarningSignal>>(`/api/v1/warning-execution/signals/${id}/${action}`, { method: 'POST', data });
  return response.data;
}

export const acknowledgeWarningSignal = (id: string, expectedVersion: number) => signalPost(id, 'acknowledge', { expectedVersion });
export const startWarningSignalHandling = (id: string, expectedVersion: number) => signalPost(id, 'handling', { expectedVersion });
export const closeWarningSignal = (id: string, expectedVersion: number, reason: string) => signalPost(id, 'close', { expectedVersion, reason });
export const verifyWarningSignalEvidence = (id: string, expectedVersion: number, category: WarningEvidenceCategory) => signalPost(id, 'evidence', { expectedVersion, category });

export async function startWarningEmergencyResponse(id: string, expectedVersion: number) {
  const response = await request<ApiResponse<{ signal: WarningSignal; event: EmergencyEvent }>>(`/api/v1/warning-execution/signals/${id}/emergency`, { method: 'POST', data: { expectedVersion } });
  return response.data;
}
