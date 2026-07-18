/** @jest-environment node */

import { request } from '@umijs/max';
import {
  advanceEventReviewAction,
  closeEventReviewByApi,
  getEventReviews,
} from './eventReviews';

jest.mock('@umijs/max', () => ({ request: jest.fn() }));

const requestMock = request as jest.Mock;

describe('event review API client', () => {
  beforeEach(() => requestMock.mockReset());

  test('读取区域授权范围内的复盘记录', async () => {
    const reviews = [{ id: 'review-001', version: 1 }];
    requestMock.mockResolvedValue({ data: reviews });
    await expect(getEventReviews()).resolves.toBe(reviews);
    expect(requestMock).toHaveBeenCalledWith('/api/v1/event-reviews');
  });

  test('整改推进和关闭均携带当前服务端版本', async () => {
    requestMock.mockResolvedValue({ data: { id: 'review-001', version: 2 } });
    await advanceEventReviewAction('review-001', 'action-003', 1);
    expect(requestMock).toHaveBeenLastCalledWith(
      '/api/v1/event-reviews/review-001/actions/advance',
      { method: 'POST', data: { actionId: 'action-003', expectedVersion: 1 } },
    );

    await closeEventReviewByApi('review-001', 2);
    expect(requestMock).toHaveBeenLastCalledWith('/api/v1/event-reviews/review-001/close', {
      method: 'POST',
      data: { expectedVersion: 2 },
    });
  });
});
