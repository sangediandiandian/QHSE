import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { IamService } from '../iam/iam.service';
import { EventReviewService } from '../event-reviews/event-review.service';
import { InMemoryEventReviewRepository } from '../event-reviews/in-memory-event-review.repository';
import { InMemoryWorkflowRepository } from '../workflows/in-memory-workflow.repository';
import { WorkflowService } from '../workflows/workflow.service';
import { InMemoryEmergencyEventRepository } from './in-memory-emergency-event.repository';
import { EmergencyEventService, type EmergencyAccess } from './emergency-event.service';

const dispatcher: EmergencyAccess = {
  actorId: 'user-dispatcher',
  actorName: '陈涛',
  roleCodes: ['production_dispatcher'],
};
const qhse: EmergencyAccess = {
  actorId: 'user-qhse',
  actorName: '赵磊',
  roleCodes: ['qhse_manager'],
};
const unitManager: EmergencyAccess = {
  actorId: 'user-unit-manager',
  actorName: '高峰',
  roleCodes: ['unit_manager'],
  allowedAreaIds: ['area-01'],
};

function createService(eventReviews?: EventReviewService) {
  let sequence = 0;
  return new EmergencyEventService(
    new InMemoryEmergencyEventRepository(),
    new WorkflowService(new InMemoryWorkflowRepository(), {
      createId: () => `workflow-${++sequence}`,
      now: () => new Date('2026-07-15T08:00:00.000Z'),
    }),
    new IamService(),
    {
      createId: () => `event-part-${++sequence}`,
      now: () => new Date('2026-07-15T08:00:00.000Z'),
      createCode: () => 'EC20260715001',
    },
    undefined,
    eventReviews,
  );
}

describe('EmergencyEventService', () => {
  it('将预警转为待研判事件且拒绝重复转化', async () => {
    const service = createService();
    const input = {
      eventId: 'signal-new',
      title: '联合预警',
      areaId: 'area-02',
      source: '联合预警' as const,
      responseLevel: 'III级' as const,
      summary: '多源信号同时命中',
    };
    const created = await service.create(input, dispatcher);
    expect(created).toMatchObject({ status: '待研判', areaName: '催化裂化装置', version: 1 });
    await expect(service.create(input, dispatcher)).rejects.toBeInstanceOf(ConflictException);
  });

  it('执行研判、升级、降级和终止状态机', async () => {
    const service = createService();
    const started = await service.transition(
      'lifecycle-004',
      { action: '研判启动', expectedVersion: 1 },
      dispatcher,
    );
    const upgraded = await service.transition(
      started.id,
      { action: '升级响应', expectedVersion: 2 },
      dispatcher,
    );
    const downgraded = await service.transition(
      started.id,
      { action: '降级响应', expectedVersion: 3 },
      dispatcher,
    );
    const monitoring = await service.transition(
      started.id,
      { action: '终止响应', expectedVersion: 4 },
      dispatcher,
    );
    expect([
      started.status,
      upgraded.responseLevel,
      downgraded.responseLevel,
      monitoring.status,
    ]).toEqual(['响应中', 'III级', 'IV级', '监控中']);
  });

  it('非法迁移和旧版本写入被拒绝', async () => {
    const service = createService();
    await expect(
      service.transition('lifecycle-002', { action: '升级响应', expectedVersion: 1 }, dispatcher),
    ).rejects.toMatchObject({ response: { code: 'EMERGENCY_STATE_CONFLICT' } });
    await service.transition(
      'lifecycle-001',
      { action: '终止响应', expectedVersion: 1 },
      dispatcher,
    );
    await expect(
      service.transition('lifecycle-001', { action: '研判启动', expectedVersion: 1 }, dispatcher),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('关闭申请复用审批流并由异人签署关闭', async () => {
    const eventReviews = new EventReviewService(
      new InMemoryEventReviewRepository(),
      () => new Date('2026-07-15T08:00:00.000Z'),
      () => 'generated-review-part',
    );
    const service = createService(eventReviews);
    const pending = await service.requestClose(
      'lifecycle-003',
      { expectedVersion: 1 },
      unitManager,
    );
    expect(pending.closureApproval).toMatchObject({
      status: '待审批',
      applicant: '高峰',
      workflowVersion: 1,
    });
    await expect(
      service.approveClose(pending.id, { opinion: '本人审批', expectedVersion: 2 }, unitManager),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const closed = await service.approveClose(
      pending.id,
      { opinion: '同意关闭', expectedVersion: 2 },
      qhse,
    );
    expect(closed).toMatchObject({
      status: '已关闭',
      version: 3,
      closureApproval: { status: '已通过', opinion: '同意关闭' },
    });
    expect(closed.closureApproval?.signature).toContain('赵磊');
    await expect(eventReviews.list()).resolves.toEqual([
      expect.objectContaining({ eventId: 'evt-003', status: '待关闭' }),
      expect.objectContaining({ eventId: 'evt-001' }),
    ]);
    await expect(
      service.approveClose(closed.id, { opinion: '重复请求', expectedVersion: 3 }, qhse),
    ).resolves.toEqual(closed);
    await expect(eventReviews.list()).resolves.toHaveLength(2);
  });

  it('区域数据范围和可信上传人由服务端控制', async () => {
    const service = createService();
    await expect(service.get('lifecycle-001', unitManager.allowedAreaIds)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const updated = await service.addEvidence(
      'lifecycle-003',
      { name: '复查报告', category: '监测报告', note: '参数稳定', expectedVersion: 1 },
      unitManager,
    );
    expect(updated.evidence.at(-1)).toMatchObject({
      uploaderId: 'user-unit-manager',
      uploader: '高峰',
    });
  });
});
