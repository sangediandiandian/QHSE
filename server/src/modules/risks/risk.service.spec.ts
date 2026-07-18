/** @jest-environment node */

import { ConflictException } from '@nestjs/common';
import { InMemoryRiskRepository } from './in-memory-risk.repository';
import { RiskService } from './risk.service';

function createService() {
  return new RiskService(new InMemoryRiskRepository(), {
    now: () => new Date('2026-07-14T08:00:00.000Z'),
    createId: () => 'assessment-test',
  });
}

const qhseAccess = {
  actorId: 'user-qhse',
  actorName: '赵磊',
};

describe('RiskService', () => {
  test('按区域和风险等级筛选', async () => {
    const result = await createService().list({ areaId: 'area-02', level: 'critical' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('risk-001');
  });

  test('提交 LEC 评估后等待异人审批，不立即改变风险等级', async () => {
    const result = await createService().assess(
      'risk-002',
      {
        likelihood: 10,
        exposure: 6,
        consequence: 7,
        basis: '现场复核',
        expectedVersion: 1,
      },
      qhseAccess,
    );
    expect(result).toMatchObject({ currentLevel: 'high', version: 2 });
    expect(result.assessments[0]).toMatchObject({
      id: 'assessment-test',
      assessorId: 'user-qhse',
      assessor: '赵磊',
      score: 420,
      status: 'pending',
    });
  });

  test('异人批准后风险等级生效并保留完整审批历史', async () => {
    const service = createService();
    await service.assess(
      'risk-002',
      {
        likelihood: 10,
        exposure: 6,
        consequence: 7,
        basis: '现场复核',
        expectedVersion: 1,
      },
      qhseAccess,
    );
    const result = await service.reviewAssessment(
      'risk-002',
      'assessment-test',
      { decision: 'approve', opinion: '同意调整', expectedVersion: 2 },
      { actorId: 'user-leader', actorName: '刘总' },
    );
    expect(result).toMatchObject({ currentLevel: 'critical', version: 3 });
    expect(result.assessments[0]).toMatchObject({
      status: 'approved',
      reviewerId: 'user-leader',
      reviewer: '刘总',
      opinion: '同意调整',
    });
  });

  test('拒绝本人审批、重复待办和无意见驳回', async () => {
    const service = createService();
    await service.assess(
      'risk-002',
      {
        likelihood: 10,
        exposure: 6,
        consequence: 7,
        basis: '现场复核',
        expectedVersion: 1,
      },
      qhseAccess,
    );
    await expect(
      service.reviewAssessment(
        'risk-002',
        'assessment-test',
        { decision: 'approve', expectedVersion: 2 },
        qhseAccess,
      ),
    ).rejects.toMatchObject({ response: { code: 'RISK_DUAL_CONTROL_REQUIRED' } });
    await expect(
      service.reviewAssessment(
        'risk-002',
        'assessment-test',
        { decision: 'reject', expectedVersion: 2 },
        { actorId: 'user-leader', actorName: '刘总' },
      ),
    ).rejects.toMatchObject({ response: { code: 'RISK_REVIEW_OPINION_REQUIRED' } });
    await expect(
      service.assess(
        'risk-002',
        {
          likelihood: 3,
          exposure: 3,
          consequence: 7,
          basis: '重复提交',
          expectedVersion: 2,
        },
        { actorId: 'user-unit', actorName: '李建国' },
      ),
    ).rejects.toMatchObject({ response: { code: 'RISK_ASSESSMENT_ALREADY_PENDING' } });
  });

  test('保存责任化管控措施', async () => {
    const result = await createService().saveControls(
      'risk-001',
      {
        controls: [{ content: ' 每班巡检 ', owner: ' 李建国 ', status: '有效' }],
        expectedVersion: 1,
      },
      qhseAccess,
    );
    expect(result.controls).toEqual(['每班巡检']);
    expect(result.controlRecords[0]).toMatchObject({ owner: '李建国', status: '有效' });
  });

  test('拒绝旧版本覆盖数据', async () => {
    await expect(
      createService().saveControls(
        'risk-001',
        {
          controls: [{ content: '每班巡检', owner: '李建国', status: '有效' }],
          expectedVersion: 9,
        },
        qhseAccess,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  test('按授权区域过滤列表并隐藏越权详情', async () => {
    const service = createService();
    await expect(service.list({}, ['area-02'])).resolves.toHaveLength(1);
    await expect(service.get('risk-002', ['area-02'])).rejects.toMatchObject({ status: 404 });
  });

  test('拒绝跨授权区域更新风险', async () => {
    await expect(
      createService().assess(
        'risk-002',
        {
          likelihood: 10,
          exposure: 6,
          consequence: 7,
          basis: '越权评估',
          expectedVersion: 1,
        },
        { ...qhseAccess, allowedAreaIds: ['area-02'] },
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
