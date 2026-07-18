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

  test('绑定真实调查附件并固化服务端上传人和哈希', async () => {
    const attachments = {
      bind: jest.fn(async () => ({
        id: 'object-review-1',
        originalName: '调查报告.pdf',
        contentType: 'application/pdf',
        size: 2048,
        sha256: 'review-sha256',
      })),
    };
    const instance = new EventReviewService(
      new InMemoryEventReviewRepository(),
      () => new Date('2026-07-18T12:00:00.000Z'),
      () => 'review-part',
      attachments as never,
    );
    const updated = await instance.addEvidence(
      'review-001',
      {
        objectId: 'object-review-1',
        name: '泵法兰失效调查报告',
        category: '调查报告',
        note: '包含材料检验和原因分析。',
        expectedVersion: 1,
      },
      manager,
    );
    expect(attachments.bind).toHaveBeenCalledWith(
      'object-review-1',
      { businessType: 'event_review', businessId: 'review-001', areaId: 'area-02' },
      manager,
    );
    expect(updated.evidence).toEqual([
      expect.objectContaining({
        objectId: 'object-review-1',
        uploaderId: 'user-unit',
        uploader: '李建国',
        hash: 'review-sha256',
      }),
    ]);
  });

  test('新增整改措施并在完成前调整责任人和期限', async () => {
    const instance = service();
    const added = await instance.addAction(
      'review-001',
      {
        title: '更新高温泵法兰检查标准',
        ownerDepartment: '设备管理部',
        owner: '孙工',
        deadline: '2026-07-25',
        priority: '重要',
        expectedVersion: 1,
      },
      manager,
    );
    const action = added.actions.at(-1)!;
    expect(action).toMatchObject({ title: '更新高温泵法兰检查标准', status: '待整改' });

    const adjusted = await instance.updateAction(
      added.id,
      action.id,
      {
        title: action.title,
        ownerDepartment: '生产运行部',
        owner: '陈涛',
        deadline: '2026-07-28',
        priority: '紧急',
        expectedVersion: 2,
      },
      manager,
    );
    expect(adjusted.actions.at(-1)).toMatchObject({
      ownerDepartment: '生产运行部',
      owner: '陈涛',
      deadline: '2026-07-28',
      priority: '紧急',
    });
  });

  test('整改措施幂等转为隐患并同步隐患关闭状态', async () => {
    const hazards = {
      create: jest.fn(async () => ({
        id: 'hazard-review-action-003',
        code: 'YH20260718001',
        status: '待整改',
        updatedAt: '2026-07-18T12:00:00.000Z',
      })),
      get: jest.fn(async () => ({
        id: 'hazard-review-action-003',
        code: 'YH20260718001',
        status: '已关闭',
        updatedAt: '2026-07-19T08:30:00.000Z',
      })),
    };
    const instance = new EventReviewService(
      new InMemoryEventReviewRepository(),
      () => new Date('2026-07-18T12:00:00.000Z'),
      undefined,
      undefined,
      hazards as never,
    );

    const linked = await instance.linkActionToHazard(
      'review-001',
      'action-003',
      {
        riskUnitId: 'risk-001',
        level: '较大',
        category: '管理缺陷',
        expectedVersion: 1,
      },
      manager,
    );
    expect(hazards.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '修订开停车后法兰专项检查清单',
        source: '复盘整改',
        riskUnitId: 'risk-001',
        discoveredAt: '2026-07-18',
        deadline: '2026-07-18',
        measures: ['修订开停车后法兰专项检查清单'],
      }),
      manager,
      'area-02',
    );
    expect(linked.review.actions.find((item) => item.id === 'action-003')).toMatchObject({
      linkedHazardId: 'hazard-review-action-003',
      linkedHazardCode: 'YH20260718001',
      linkedHazardStatus: '待整改',
      linkedAt: '2026-07-18T12:00:00.000Z',
    });

    const repeated = await instance.linkActionToHazard(
      'review-001',
      'action-003',
      {
        riskUnitId: 'risk-001',
        level: '较大',
        category: '管理缺陷',
        expectedVersion: 1,
      },
      manager,
    );
    expect(hazards.create).toHaveBeenCalledTimes(1);
    expect(repeated.review.version).toBe(2);

    const synced = await instance.syncActionHazards('review-001', 2, manager);
    expect(synced.actions.find((item) => item.id === 'action-003')).toMatchObject({
      status: '已完成',
      linkedHazardStatus: '已关闭',
      completedAt: '2026-07-19T08:30:00.000Z',
    });
    expect(synced.version).toBe(3);
  });
});
