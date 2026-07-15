import type {
  EmergencyResource,
  EmergencyResourceBatchInput,
  EmergencyResourceDispatchInput,
  EmergencyResourceInput,
  EmergencyResourceInspectionInput,
} from '@/types/qhse';
import { request } from '@umijs/max';
interface ApiResponse<T> {
  success: boolean;
  data: T;
}
const post = async (id: string, path: string, data: Record<string, unknown>) =>
  (
    await request<ApiResponse<EmergencyResource>>(`/api/v1/emergency-resources/${id}/${path}`, {
      method: 'POST',
      data,
    })
  ).data;
export const getEmergencyResources = async () =>
  (await request<ApiResponse<EmergencyResource[]>>('/api/v1/emergency-resources')).data;
export const createEmergencyResource = async (input: EmergencyResourceInput) =>
  (
    await request<ApiResponse<EmergencyResource>>('/api/v1/emergency-resources', {
      method: 'POST',
      data: input,
    })
  ).data;
export const addEmergencyResourceBatch = (
  id: string,
  input: EmergencyResourceBatchInput,
  expectedVersion: number,
) => post(id, 'batches', { ...input, expectedVersion });
export const dispatchEmergencyResource = (
  id: string,
  input: Omit<EmergencyResourceDispatchInput, 'id' | 'dispatchedAt'>,
  expectedVersion: number,
) =>
  post(id, 'dispatches', {
    eventName: input.eventName,
    destination: input.destination,
    quantity: input.quantity,
    expectedVersion,
  });
export const confirmEmergencyResourceArrival = (
  id: string,
  dispatchId: string,
  expectedVersion: number,
) => post(id, `dispatches/${dispatchId}/arrival`, { expectedVersion });
export const returnEmergencyResource = (id: string, dispatchId: string, expectedVersion: number) =>
  post(id, `dispatches/${dispatchId}/return`, { expectedVersion });
export const inspectEmergencyResource = (
  id: string,
  input: Omit<EmergencyResourceInspectionInput, 'id' | 'inspectedAt'>,
  expectedVersion: number,
) =>
  post(id, 'inspections', {
    result: input.result,
    nextInspection: input.nextInspection,
    note: input.note,
    expectedVersion,
  });
