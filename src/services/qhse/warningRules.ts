import type { WarningRule, WarningRuleDraftInput } from '@/types/qhse';
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
