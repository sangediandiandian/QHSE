import type { AlarmEvent, WorkPermit } from '@/types/qhse';
import { applyPermitAlarmLinkage, nextHazardStatus, nextPermitStatus } from './managementWorkflow';

const permit: WorkPermit = {
  id: 'permit-1', code: 'DH-001', type: '动火作业', areaId: 'area-02', areaName: '催化裂化装置',
  workContent: '泵出口法兰修复', applicant: '李工', guardian: '王强', startAt: '08:00', endAt: '12:00',
  riskLevel: '重大', status: '作业中', gasTest: '08:00 检测合格', linkedGdsCodes: ['GDS-101'],
  safetyMeasures: ['清除可燃物'],
};

const alarm: AlarmEvent = {
  id: 'alarm-1', code: 'W001', title: '可燃气体浓度持续上升', source: 'GDS', areaId: 'area-02',
  areaName: '催化裂化装置', level: 'high', value: '38% LEL', occurredAt: '08:28', status: '待确认',
};

describe('management workflow', () => {
  it('隐患按整改、验收、关闭顺序流转', () => {
    expect(nextHazardStatus('待整改')).toBe('整改中');
    expect(nextHazardStatus('整改中')).toBe('待验收');
    expect(nextHazardStatus('待验收')).toBe('已关闭');
  });

  it('较大及以上告警触发同区域在办作业暂停建议', () => {
    expect(applyPermitAlarmLinkage([permit], [alarm])[0]).toMatchObject({
      status: '建议暂停',
      alertReason: expect.stringContaining('可燃气体浓度持续上升'),
    });
  });

  it('一般告警与非作业中票证不触发暂停建议', () => {
    const normalAlarm = { ...alarm, level: 'medium' as const };
    expect(applyPermitAlarmLinkage([permit], [normalAlarm])[0]).toBe(permit);
    expect(applyPermitAlarmLinkage([{ ...permit, status: '待审批' }], [alarm])[0].status).toBe('待审批');
  });

  it('暂停确认后可通过复测恢复作业', () => {
    expect(nextPermitStatus('建议暂停')).toBe('已暂停');
    expect(nextPermitStatus('已暂停')).toBe('作业中');
  });
});
