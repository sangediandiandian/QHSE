/** @jest-environment node */

import { request } from '@umijs/max';
import {
  addEventReviewEvidence,
  advanceEventReviewAction,
  closeEventReviewByApi,
  createEventReviewAction,
  downloadEventReviewReport,
  getEventReviews,
  linkEventReviewActionHazard,
  syncEventReviewActionHazards,
  updateEventReviewAnalysis,
  updateEventReviewAction,
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

  test('调查结论更新不发送可伪造的复盘负责人', async () => {
    requestMock.mockResolvedValue({ data: { id: 'review-001', version: 2 } });
    const analysis = {
      summary: '事件摘要',
      directCause: '直接原因',
      rootCause: '根本原因',
      lesson: '经验教训',
    };
    await updateEventReviewAnalysis('review-001', analysis, 1);
    expect(requestMock).toHaveBeenLastCalledWith('/api/v1/event-reviews/review-001/analysis', {
      method: 'PUT',
      data: { ...analysis, expectedVersion: 1 },
    });
  });

  test('附件和整改计划写入均携带当前版本', async () => {
    requestMock.mockResolvedValue({ data: { id: 'review-001', version: 2 } });
    await addEventReviewEvidence(
      'review-001',
      { objectId: 'object-1', name: '调查报告', category: '调查报告', note: '原因分析' },
      1,
    );
    expect(requestMock).toHaveBeenLastCalledWith('/api/v1/event-reviews/review-001/evidence', {
      method: 'POST',
      data: {
        objectId: 'object-1',
        name: '调查报告',
        category: '调查报告',
        note: '原因分析',
        expectedVersion: 1,
      },
    });
    const action = {
      title: '修订检查表',
      ownerDepartment: '设备部',
      owner: '孙工',
      deadline: '2026-07-30',
      priority: '重要' as const,
    };
    await createEventReviewAction('review-001', action, 2);
    await updateEventReviewAction('review-001', 'action-1', action, 3);
    expect(requestMock).toHaveBeenLastCalledWith(
      '/api/v1/event-reviews/review-001/actions/action-1',
      { method: 'PUT', data: { ...action, expectedVersion: 3 } },
    );
  });

  test('整改转隐患和状态同步携带当前复盘版本', async () => {
    requestMock.mockResolvedValue({
      data: {
        review: { id: 'review-001', version: 2 },
        hazard: { id: 'hazard-001', code: 'YH001' },
      },
    });
    await linkEventReviewActionHazard(
      'review-001',
      'action-1',
      { riskUnitId: 'risk-001', level: '较大', category: '管理缺陷' },
      1,
    );
    expect(requestMock).toHaveBeenLastCalledWith(
      '/api/v1/event-reviews/review-001/actions/action-1/hazard',
      {
        method: 'POST',
        data: {
          riskUnitId: 'risk-001',
          level: '较大',
          category: '管理缺陷',
          expectedVersion: 1,
        },
      },
    );

    requestMock.mockResolvedValue({ data: { id: 'review-001', version: 3 } });
    await syncEventReviewActionHazards('review-001', 2);
    expect(requestMock).toHaveBeenLastCalledWith(
      '/api/v1/event-reviews/review-001/actions/hazards/sync',
      { method: 'POST', data: { expectedVersion: 2 } },
    );
  });

  test('复盘报告从服务端下载，不在浏览器拼装业务内容', async () => {
    const blob = { size: 1024 } as Blob;
    requestMock.mockResolvedValue(blob);
    await expect(downloadEventReviewReport('review-001')).resolves.toBe(blob);
    expect(requestMock).toHaveBeenLastCalledWith('/api/v1/event-reviews/review-001/report', {
      method: 'GET',
      responseType: 'blob',
    });
  });
});
