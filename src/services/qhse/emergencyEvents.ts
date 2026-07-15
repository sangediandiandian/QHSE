import type { EmergencyEvent, EmergencyEventAction, EmergencyEventEvidence } from '@/types/qhse';
import { request } from '@umijs/max';

interface ApiResponse<T> { success: boolean; data: T; requestId: string; timestamp: string }

export async function getEmergencyEvents() {
  const response = await request<ApiResponse<EmergencyEvent[]>>('/api/v1/emergency-events', { method: 'GET' });
  return response.data;
}

async function post(id: string, path: string, data: Record<string, unknown>) {
  const response = await request<ApiResponse<EmergencyEvent>>(`/api/v1/emergency-events/${id}/${path}`, { method: 'POST', data });
  return response.data;
}

export const transitionEmergencyEvent = (id: string, action: Exclude<EmergencyEventAction, '申请关闭' | '审批关闭'>, expectedVersion: number) => post(id, 'actions', { action, expectedVersion });
export const requestEmergencyClosure = (id: string, expectedVersion: number) => post(id, 'closure-request', { expectedVersion });
export const remindEmergencyClosure = (id: string, expectedVersion: number) => post(id, 'closure-reminder', { expectedVersion });
export const approveEmergencyClosure = (id: string, opinion: string, expectedVersion: number, workflowVersion?: number) => post(id, 'closure-approval', { opinion, expectedVersion, workflowVersion });

export function addEmergencyEvidence(id: string, evidence: Pick<EmergencyEventEvidence, 'name' | 'category' | 'note'>, expectedVersion: number) {
  return post(id, 'evidence', { ...evidence, expectedVersion });
}
