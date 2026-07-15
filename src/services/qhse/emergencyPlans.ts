import type { EmergencyDrillInput, EmergencyDrillRecordInput, EmergencyPlanDraftInput, EmergencyPlanTemplate } from '@/types/qhse';
import { request } from '@umijs/max';
interface ApiResponse<T> { success: boolean; data: T }
const post = async (id: string, path: string, data: Record<string, unknown>) => (await request<ApiResponse<EmergencyPlanTemplate>>(`/api/v1/emergency-plans/${id}/${path}`, { method: 'POST', data })).data;
export const getEmergencyPlans = async () => (await request<ApiResponse<EmergencyPlanTemplate[]>>('/api/v1/emergency-plans')).data;
export const createEmergencyPlan = async (input: EmergencyPlanDraftInput) => (await request<ApiResponse<EmergencyPlanTemplate>>('/api/v1/emergency-plans', { method: 'POST', data: input })).data;
export const updateEmergencyPlan = async (id: string, input: EmergencyPlanDraftInput, expectedRevision: number) => (await request<ApiResponse<EmergencyPlanTemplate>>(`/api/v1/emergency-plans/${id}/draft`, { method: 'PUT', data: { ...input, expectedRevision } })).data;
export const submitEmergencyPlan = (id: string, expectedRevision: number) => post(id, 'submit', { expectedRevision });
export const approveEmergencyPlan = (id: string, expectedRevision: number) => post(id, 'approve', { expectedRevision });
export const rollbackEmergencyPlan = (id: string, version: string, expectedRevision: number) => post(id, 'rollback', { version, expectedRevision });
export const addEmergencyDrill = (id: string, input: EmergencyDrillInput, expectedRevision: number) => post(id, 'drills', { ...input, expectedRevision });
export const startEmergencyDrill = (id: string, drillId: string, expectedRevision: number) => post(id, `drills/${drillId}/start`, { expectedRevision });
export const recordEmergencyDrill = (id: string, drillId: string, input: EmergencyDrillRecordInput, expectedRevision: number) => post(id, `drills/${drillId}/record`, { ...input, expectedRevision });
