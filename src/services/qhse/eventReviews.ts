import type {
  EventReview,
  EventReviewActionInput,
  EventReviewEvidence,
  EventReviewHazardLinkInput,
  Hazard,
} from '@/types/qhse';
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

export async function addEventReviewEvidence(
  id: string,
  input: Pick<EventReviewEvidence, 'objectId' | 'name' | 'category' | 'note'>,
  expectedVersion: number,
) {
  const response = await request<ApiResponse<EventReview>>(`/api/v1/event-reviews/${id}/evidence`, {
    method: 'POST',
    data: { ...input, expectedVersion },
  });
  return response.data;
}

export async function createEventReviewAction(
  id: string,
  input: EventReviewActionInput,
  expectedVersion: number,
) {
  const response = await request<ApiResponse<EventReview>>(`/api/v1/event-reviews/${id}/actions`, {
    method: 'POST',
    data: { ...input, expectedVersion },
  });
  return response.data;
}

export async function updateEventReviewAction(
  id: string,
  actionId: string,
  input: EventReviewActionInput,
  expectedVersion: number,
) {
  const response = await request<ApiResponse<EventReview>>(
    `/api/v1/event-reviews/${id}/actions/${actionId}`,
    { method: 'PUT', data: { ...input, expectedVersion } },
  );
  return response.data;
}

export async function linkEventReviewActionHazard(
  id: string,
  actionId: string,
  input: EventReviewHazardLinkInput,
  expectedVersion: number,
) {
  const response = await request<ApiResponse<{ review: EventReview; hazard: Hazard }>>(
    `/api/v1/event-reviews/${id}/actions/${actionId}/hazard`,
    { method: 'POST', data: { ...input, expectedVersion } },
  );
  return response.data;
}

export async function syncEventReviewActionHazards(id: string, expectedVersion: number) {
  const response = await request<ApiResponse<EventReview>>(
    `/api/v1/event-reviews/${id}/actions/hazards/sync`,
    { method: 'POST', data: { expectedVersion } },
  );
  return response.data;
}

export async function closeEventReviewByApi(id: string, expectedVersion: number) {
  const response = await request<ApiResponse<EventReview>>(`/api/v1/event-reviews/${id}/close`, {
    method: 'POST',
    data: { expectedVersion },
  });
  return response.data;
}
