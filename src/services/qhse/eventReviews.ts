import type { EventReview } from '@/types/qhse';
import { request } from '@umijs/max';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  requestId: string;
  timestamp: string;
}

export async function getEventReviews() {
  const response = await request<ApiResponse<EventReview[]>>('/api/v1/event-reviews');
  return response.data;
}

export async function advanceEventReviewAction(
  id: string,
  actionId: string,
  expectedVersion: number,
) {
  const response = await request<ApiResponse<EventReview>>(
    `/api/v1/event-reviews/${id}/actions/advance`,
    { method: 'POST', data: { actionId, expectedVersion } },
  );
  return response.data;
}

export async function updateEventReviewAnalysis(
  id: string,
  input: Pick<EventReview, 'summary' | 'directCause' | 'rootCause' | 'lesson'>,
  expectedVersion: number,
) {
  const response = await request<ApiResponse<EventReview>>(`/api/v1/event-reviews/${id}/analysis`, {
    method: 'PUT',
    data: { ...input, expectedVersion },
  });
  return response.data;
}

export async function closeEventReviewByApi(id: string, expectedVersion: number) {
  const response = await request<ApiResponse<EventReview>>(`/api/v1/event-reviews/${id}/close`, {
    method: 'POST',
    data: { expectedVersion },
  });
  return response.data;
}
