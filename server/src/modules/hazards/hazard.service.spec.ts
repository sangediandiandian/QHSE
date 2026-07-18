/** @jest-environment node */

import { BadRequestException, ConflictException } from '@nestjs/common';
import { InMemoryRiskRepository } from '../risks/in-memory-risk.repository';
import { RiskService } from '../risks/risk.service';
import { HazardService } from './hazard.service';
import { InMemoryHazardRepository } from './in-memory-hazard.repository';

function createService() {
  let sequence = 0;
  return new HazardService(
    new InMemoryHazardRepository(),
    new RiskService(new InMemoryRiskRepository()),
    {
      now: () => new Date('2026-07-15T08:00:00.000Z'),
      createId: () => `generated-${++sequence}`,
      createCode: () => 'YH20260715001',
    },
  );
}

const qhseAccess = {
  actorId: 'user-qhse',
  actorName: '赵磊',
};

describe('HazardService', () => {
  test('按区域数据范围过滤并隐藏越权详情', async () => {
    const service = createService();
    await expect(service.list({}, ['area-02'])).resolves.toHaveLength(2);
    await expect(service.get('hazard-003', ['area-02'])).rejects.toMatchObject({ status: 404 });
  });

  test('从风险单元派生区域并由服务端生成操作人', async () => {
    const result = await createService().create(
      {
        title: ' 新上报隐患 ',
        riskUnitId: 'risk-001',
        level: '重大',
        source: '现场检查',
        category: '设备设施',
        ownerDepartment: '催化裂化装置',
        owner: '李建国',
        discoveredAt: '2026-07-15',
        deadline: '2026-07-18',
        description: ' 泵区发现异常 ',
        measures: [' 现场复核 '],
      },
      qhseAccess,
    );

    expect(result).toMatchObject({
      code: 'YH20260715001',
      areaId: 'area-02',
      areaName: '催化裂化装置',
      status: '待整改',
      supervised: true,
      version: 1,
    });
    expect(result.operations[0]).toMatchObject({
      action: '上报',
      operatorId: 'user-qhse',
      operator: '赵磊',
    });
  });

  test('完成整改、证据、提交验收和关闭全流程', async () => {
    const service = createService();
    const started = await service.start('hazard-003', { expectedVersion: 1 }, qhseAccess);
    expect(started).toMatchObject({ status: '整改中', version: 2 });

    await expect(
      service.submit('hazard-003', { expectedVersion: 2 }, qhseAccess),
    ).rejects.toBeInstanceOf(BadRequestException);

    const evidenced = await service.addEvidence(
      'hazard-003',
      {
        name: '整改完成照片.jpg',
        category: '整改完成',
        note: '现场复核',
        expectedVersion: 2,
      },
      qhseAccess,
    );
    expect(evidenced.evidence[0]).toMatchObject({ uploaderId: 'user-qhse', uploader: '赵磊' });

    const submitted = await service.submit('hazard-003', { expectedVersion: 3 }, qhseAccess);
    expect(submitted).toMatchObject({ status: '待验收', version: 4 });

    const closed = await service.close(
      'hazard-003',
      {
        opinion: ' 整改有效，验收通过 ',
        expectedVersion: 4,
      },
      qhseAccess,
    );
    expect(closed).toMatchObject({
      status: '已关闭',
      acceptanceOpinion: '整改有效，验收通过',
      version: 5,
      overdue: false,
    });
    expect(closed.operations.map((item) => item.action)).toEqual([
      '上报',
      '开始整改',
      '提交验收',
      '验收关闭',
    ]);
  });

  test('拒绝非法状态流转和旧版本覆盖', async () => {
    const service = createService();
    await expect(
      service.close('hazard-003', { opinion: '通过', expectedVersion: 1 }, qhseAccess),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.start('hazard-003', { expectedVersion: 9 }, qhseAccess),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  test('挂牌使用显式目标值并保持同值幂等', async () => {
    const service = createService();
    const supervised = await service.updateSupervision(
      'hazard-003',
      {
        supervised: true,
        expectedVersion: 1,
      },
      qhseAccess,
    );
    expect(supervised).toMatchObject({ supervised: true, version: 2 });
    const unchanged = await service.updateSupervision(
      'hazard-003',
      {
        supervised: true,
        expectedVersion: 1,
      },
      qhseAccess,
    );
    expect(unchanged).toMatchObject({ supervised: true, version: 2 });
  });

  test('临期和逾期隐患每日只生成一次系统催办记录', async () => {
    const service = createService();
    const first = await service.runReminders();
    expect(first).toMatchObject({ scanned: 6, created: 5, skipped: 1, failed: 0 });
    const reminded = await service.get('hazard-002');
    expect(reminded.operations.at(-1)).toMatchObject({
      action: '整改催办',
      operatorId: 'system-hazard-reminder',
      operator: '系统自动催办',
    });
    expect(reminded.operations.at(-1)?.detail).toContain('[reminder:overdue:2026-07-15]');

    const repeated = await service.runReminders();
    expect(repeated).toMatchObject({ scanned: 6, created: 0, skipped: 6, failed: 0 });
  });

  test('拒绝倒置日期和跨区域上报', async () => {
    const input = {
      title: '日期异常',
      riskUnitId: 'risk-001',
      level: '一般' as const,
      source: '现场检查' as const,
      category: '设备设施',
      ownerDepartment: '催化裂化装置',
      owner: '李建国',
      discoveredAt: '2026-07-16',
      deadline: '2026-07-15',
      description: '测试',
      measures: ['复核'],
    };
    await expect(createService().create(input, qhseAccess)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      createService().create(
        { ...input, discoveredAt: '2026-07-15', deadline: '2026-07-16' },
        {
          ...qhseAccess,
          allowedAreaIds: ['area-04'],
        },
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      createService().create(
        { ...input, discoveredAt: '2026-07-15', deadline: '2026-07-16' },
        qhseAccess,
        'area-04',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'HAZARD_AREA_MISMATCH' }),
    });
  });
});
