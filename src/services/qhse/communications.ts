import type { CommunicationDispatch } from '@/types/qhse';
import { request } from '@umijs/max';
interface ApiResponse<T> {
  success: boolean;
  data: T;
}
const post = async (path: string, expectedVersion: number) =>
  (
    await request<ApiResponse<CommunicationDispatch>>(`/api/v1/communications/${path}`, {
      method: 'POST',
      data: { expectedVersion },
    })
  ).data;
export const getCommunicationDispatches = async () =>
  (await request<ApiResponse<CommunicationDispatch[]>>('/api/v1/communications')).data;
export const escalateCommunication = (eventId: string, expectedVersion: number) =>
  post(`${eventId}/escalate`, expectedVersion);
export const confirmCommunicationTask = (
  eventId: string,
  taskId: string,
  expectedVersion: number,
) => post(`${eventId}/tasks/${taskId}/confirm`, expectedVersion);
