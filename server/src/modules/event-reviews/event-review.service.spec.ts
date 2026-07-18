/** @jest-environment node */

import { InMemoryEventReviewRepository } from './in-memory-event-review.repository';
import { EventReviewService } from './event-review.service';
import { emergencyEventSeed } from '../emergency-events/emergency-event.seed';

const manager = {
  actorId: 'user-unit',
  actorName: '李建国',
  allowedAreaIds: ['area-02'],
};
const approver = {
  actorId: 'user-qhse',
  actorName: '赵磊',
};

describe('EventReviewService', () => {
  const service = () =>
    new EventReviewService(
      new InMemoryEventReviewRepository(),
      () => new Date('2026-07-18T12:00:00.000Z'),
    );

  test('按区域查询复盘并阻止越权读取', async () => {
    const instance = service();
    await expect(instance.list(['area-02'])).resolves.toHaveLength(1);
    await expect(instance.list(['area-04'])).resolves.toEqual([]);
    await expect(instance.get('review-001', ['area-04'])).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'EVENT_REVIEW_NOT_FOUND' }),
    });
  });

  test('整改措施按待整改、整改中、已完成顺序推进并记录可信操作人', async () => {
    const instance = service();
    const started = await instance.advanceAction('review-001', 'action-003', 1, manager);
    expect(started).toMatchObject({ version: 2 });
    expect(started.actions.find((item) => item.id === 'action-003')).toMatchObject({
      status: '整改中',
      updatedById: 'user-unit',
      updatedBy: '李建国',
    });

    const completed = await instance.advanceAction('review-001', 'action-003', 2, manager);
    expect(completed.actions.find((item) => item.id === 'action-003')).toMatchObject({
      status: '已完成',
      completedAt: '2026-07-18T12:00:00.000Z',
    });
  });

  test('整改未全部完成时禁止归档，全部完成后由审批人关闭', async () => {
    const instance = service();
    await expect(instance.close('review-001', 1, approver)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'EVENT_REVIEW_ACTIONS_INCOMPLETE' }),
    });

    let review = await instance.get('review-001');
    for (const action of review.actions.filter((item) => item.status !== '已完成')) {
      if (action.status === '待整改') {
        review = await instance.advanceAction(review.id, action.id, review.version, manager);
      }
      review = await instance.advanceAction(review.id, action.id, review.version, manager);
    }

    const closed = await instance.close(review.id, review.version, approver);
    expect(closed).toMatchObject({
      status: '已复盘',
      reviewer: '赵磊',
      closedAt: '2026-07-18T12:00:00.000Z',
    });
    expect(closed.timeline.at(-1)).toMatchObject({ title: '事件关闭', status: 'done' });
  });

  test('旧版本和已完成措施的重复推进均被拒绝', async () => {
    const instance = service();
    await instance.advanceAction('review-001', 'action-003', 1, manager);
    await expect(
      instance.advanceAction('review-001', 'action-004', 1, manager),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VERSION_CONFLICT' }),
    });
    await expect(
      instance.advanceAction('review-001', 'action-001', 2, manager),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'EVENT_REVIEW_ACTION_COMPLETED' }),
    });
  });

  test('应急事件关闭后幂等生成待复盘档案', async () => {
    const instance = service();
    const event = {
      ...emergencyEventSeed.find((item) => item.id === 'lifecycle-003')!,
      status: '已关闭' as const,
      updatedAt: '2026-07-18T11:30:00.000Z',
    };
    const created = await instance.ensureForEmergencyEvent(event, approver);
    expect(created).toMatchObject({
      eventId: 'evt-003',
      eventCode: 'EC20260711003',
      areaId: 'area-01',
      status: '待关闭',
      version: 1,
    });
    expect(created.actions).toEqual([expect.objectContaining({ status: '待整改', owner: '赵磊' })]);
    await expect(instance.ensureForEmergencyEvent(event, approver)).resolves.toEqual(created);
    await expect(instance.list()).resolves.toHaveLength(2);
  });

  test('调查负责人维护结构化结论，归档后禁止修改', async () => {
    const instance = service();
    const updated = await instance.updateAnalysis(
      'review-001',
      {
        summary: '现场处置完成，监测稳定。',
        directCause: '法兰垫片失效。',
        rootCause: '选型复核流程不完整。',
        lesson: '补充高温法兰专项检查。',
        expectedVersion: 1,
      },
      manager,
    );
    expect(updated).toMatchObject({
      reviewer: '李建国',
      summary: '现场处置完成，监测稳定。',
      directCause: '法兰垫片失效。',
      version: 2,
    });
  });
});
