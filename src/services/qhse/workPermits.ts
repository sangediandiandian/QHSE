import type { WorkPermit, WorkPermitApplyInput, WorkPermitSiteConfirmation, WorkPermitStatus } from '@/types/qhse';
import { request } from '@umijs/max';

interface ApiResponse<T> { success: boolean; data: T; requestId: string; timestamp: string }

export async function getWorkPermits(params?: { status?: WorkPermitStatus }) {
  const response = await request<ApiResponse<WorkPermit[]>>('/api/v1/work-permits', { method: 'GET', params });
  return response.data;
}

export async function applyWorkPermit(input: WorkPermitApplyInput) {
  const response = await request<ApiResponse<WorkPermit>>('/api/v1/work-permits', { method: 'POST', data: input });
  return response.data;
}

async function mutate(id: string, path: string, data: Record<string, unknown>) {
  const response = await request<ApiResponse<WorkPermit>>(`/api/v1/work-permits/${id}/${path}`, { method: 'POST', data });
  return response.data;
}

export const approveWorkPermit = (id: string, expectedVersion: number) => mutate(id, 'approvals/next', { expectedVersion });
export const confirmWorkPermitSite = (id: string, role: WorkPermitSiteConfirmation['role'], expectedVersion: number) => mutate(id, 'site-confirmations', { role, expectedVersion });
export const recommendWorkPermitPause = (id: string, reason: string, expectedVersion: number) => mutate(id, 'pause-recommendation', { reason, expectedVersion });
export const pauseWorkPermit = (id: string, expectedVersion: number) => mutate(id, 'pause', { expectedVersion });
export const resumeWorkPermit = (id: string, gasTest: string, expectedVersion: number) => mutate(id, 'resume', { gasTest, expectedVersion });
export const closeWorkPermit = (id: string, expectedVersion: number) => mutate(id, 'close', { expectedVersion });
