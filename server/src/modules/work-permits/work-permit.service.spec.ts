/** @jest-environment node */

import { ConflictException, ForbiddenException } from '@nestjs/common';
import { InMemoryWorkPermitRepository } from './in-memory-work-permit.repository';
import { WorkPermitService } from './work-permit.service';

function createService() {
  let sequence = 0;
  return new WorkPermitService(new InMemoryWorkPermitRepository(), {
    now: () => new Date('2026-07-15T08:00:00.000Z'),
    createId: () => `generated-${++sequence}`,
    createCode: () => 'DH-20260715-001',
  });
}

const unit = {
  actorId: 'user-unit',
  actorName: '李建国',
  roleCodes: ['unit_manager'],
  allowedAreaIds: ['area-02'],
};
const operator = {
  actorId: 'user-operator',
  actorName: '王强',
  roleCodes: ['operator'],
  allowedAreaIds: ['area-02'],
};
const qhse = { actorId: 'user-qhse', actorName: '赵磊', roleCodes: ['qhse_manager'] };
const dispatcher = {
  actorId: 'user-dispatcher',
  actorName: '陈涛',
  roleCodes: ['production_dispatcher'],
};

const input = {
  type: '动火作业' as const,
  areaId: 'area-02',
  workContent: 'P-208 泵出口法兰检修',
  guardian: '王强',
  startAt: '2026-07-15 09:00',
  endAt: '2026-07-15 17:00',
  riskLevel: '重大' as const,
  gasTest: '可燃气体 0%LEL，氧含量 20.9%VOL',
  linkedGdsCodes: ['GDS-101'],
  safetyMeasures: ['系统隔离', '消防器材到位'],
  workX: 52,
  workY: 24,
};

describe('WorkPermitService', () => {
  test('按区域过滤列表并隐藏跨区票证', async () => {
    const service = createService();
    await expect(service.list({}, ['area-02'])).resolves.toHaveLength(1);
    await expect(service.get('permit-002', ['area-02'])).rejects.toMatchObject({ status: 404 });
  });

  test('服务端派生申请人和区域并生成三级审批', async () => {
    const permit = await createService().create(input, unit);
    expect(permit).toMatchObject({
      code: 'DH-20260715-001',
      areaName: '催化裂化装置',
      applicantId: 'user-unit',
      applicant: '李建国',
      status: '待审批',
      version: 1,
    });
    expect(permit.approvalSteps.map((step) => step.role)).toEqual([
      '属地审核',
      'QHSE 审核',
      '负责人批准',
    ]);
  });

  test('完成三级分权审批、双人确认、暂停恢复和关闭', async () => {
    const service = createService();
    const created = await service.create(input, unit);
    const localApproved = await service.approveNext(created.id, { expectedVersion: 1 }, unit);
    const qhseApproved = await service.approveNext(created.id, { expectedVersion: 2 }, qhse);
    const approved = await service.approveNext(created.id, { expectedVersion: 3 }, dispatcher);
    expect(approved.approvalSteps.every((step) => step.status === '已通过')).toBe(true);

    const firstConfirmed = await service.confirmSite(
      created.id,
      { role: '作业负责人', expectedVersion: 4 },
      unit,
    );
    expect(firstConfirmed.status).toBe('待审批');
    const operating = await service.confirmSite(
      created.id,
      { role: '现场监护人', expectedVersion: 5 },
      operator,
    );
    expect(operating).toMatchObject({ status: '作业中', version: 6 });

    const recommended = await service.recommendPause(
      created.id,
      { reason: '同区域 GDS 二级告警', expectedVersion: 6 },
      unit,
    );
    const paused = await service.pause(created.id, { expectedVersion: 7 }, unit);
    const resumed = await service.resume(
      created.id,
      { gasTest: '复测合格，可燃气体 0%LEL', expectedVersion: 8 },
      unit,
    );
    const closed = await service.close(created.id, { expectedVersion: 9 }, unit);
    expect(recommended).toMatchObject({ status: '建议暂停', alertReason: '同区域 GDS 二级告警' });
    expect(paused.status).toBe('已暂停');
    expect(resumed).toMatchObject({ status: '作业中', alertReason: undefined });
    expect(closed).toMatchObject({ status: '已关闭', version: 10 });
  });

  test('审批节点校验角色且双人确认不能由同一人完成', async () => {
    const service = createService();
    const created = await service.create(input, unit);
    await expect(
      service.approveNext(created.id, { expectedVersion: 1 }, qhse),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await service.approveNext(created.id, { expectedVersion: 1 }, unit);
    await service.approveNext(created.id, { expectedVersion: 2 }, qhse);
    await service.approveNext(created.id, { expectedVersion: 3 }, dispatcher);
    await service.confirmSite(created.id, { role: '作业负责人', expectedVersion: 4 }, unit);
    await expect(
      service.confirmSite(created.id, { role: '现场监护人', expectedVersion: 5 }, unit),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  test('拒绝旧版本覆盖和非法状态流转', async () => {
    const service = createService();
    const created = await service.create(input, unit);
    await expect(
      service.approveNext(created.id, { expectedVersion: 9 }, unit),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(service.pause(created.id, { expectedVersion: 1 }, unit)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
