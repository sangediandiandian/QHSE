import type { GdsPoint, WorkPermit } from '@/types/qhse';
import { approveNextWorkPermitStep, calculatePermitNearestGdsDistance, confirmWorkPermitSite, createWorkPermit, getWorkPermitApprovalSteps } from './workPermitWorkflow';

const permit: WorkPermit = {
  id: 'permit-1', code: 'DH-001', type: '动火作业', areaId: 'area-1', areaName: '一号装置', workContent: '泵检修', applicant: '李强', guardian: '王强', startAt: '08:00', endAt: '12:00', riskLevel: '重大', status: '待审批', gasTest: '合格', linkedGdsCodes: ['GDS-1'], safetyMeasures: [], workX: 10, workY: 10,
};

describe('workPermitWorkflow', () => {
  test('新建票证进入三步审批流程', () => {
    const created = createWorkPermit({ ...permit, workX: 10, workY: 10 }, 'permit-2', 'DH-002');
    expect(created).toMatchObject({ status: '待审批', code: 'DH-002' });
    expect(created.approvalSteps).toHaveLength(3);
  });
  test('票证依次完成三步电子签名审批', () => {
    let next = permit;
    next = approveNextWorkPermitStep(next, '王强', '09:00');
    next = approveNextWorkPermitStep(next, '赵磊', '09:01');
    next = approveNextWorkPermitStep(next, '陈涛', '09:02');
    expect(getWorkPermitApprovalSteps(next).every((step) => step.status === '已通过')).toBe(true);
    expect(next.approvalSteps?.[0].signature).toContain('电子签名');
  });

  test('审批完成且双人现场确认后进入作业中', () => {
    const approved = { ...permit, approvalSteps: getWorkPermitApprovalSteps({ ...permit, status: '作业中' }) };
    const ownerConfirmed = confirmWorkPermitSite(approved, '作业负责人', '李强', '09:10');
    const ready = confirmWorkPermitSite(ownerConfirmed, '现场监护人', '王强', '09:11');
    expect(ready.status).toBe('作业中');
    expect(ready.siteConfirmations).toHaveLength(2);
  });

  test('审批未完成不能现场确认', () => {
    expect(() => confirmWorkPermitSite(permit, '作业负责人', '李强', '09:10')).toThrow('审批尚未全部通过');
  });

  test('根据作业点和同区域 GDS 坐标计算最近距离', () => {
    const points = [{ id: 'gds-1', areaId: 'area-1', x: 13, y: 14 }] as GdsPoint[];
    expect(calculatePermitNearestGdsDistance(permit, points)).toBe(50);
  });
});
