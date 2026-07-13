import type { AlarmEvent, DashboardData } from '@/types/qhse';
import {
  buildWarningEvidence,
  confirmWarningEvent,
  getWarningEvidenceCount,
  startWarningEmergency,
  verifyWarningEvidence,
} from './warningEvidenceWorkflow';

const event: AlarmEvent = {
  id: 'evt-1', code: 'W001', title: '泵区泄漏', source: 'GDS', areaId: 'area-1', areaName: '一号装置',
  level: 'high', value: '38% LEL', occurredAt: '08:00:00', status: '待确认',
};

const dashboard = {
  gdsPoints: [{ id: 'gds-1', code: 'GDS-1', name: '泵区探测器', areaId: 'area-1', areaName: '一号装置', equipmentName: 'P-101', gasType: '可燃气体', currentValue: 38, unit: '%LEL', alarmLevel1: 25, alarmLevel2: 40, onlineStatus: 'online', alarmStatus: 'level1', trend: [8, 12, 18, 24, 31, 38] }],
  vocPoints: [],
  mesTags: [],
  mesUnits: [{ id: 'unit-1', code: 'U1', name: '一号装置', load: 86, operatingMode: '高负荷运行', status: 'warning' }],
  workPermits: [{ id: 'permit-1', code: 'DH-001', type: '动火作业', areaId: 'area-1', areaName: '一号装置', workContent: '泵检修', applicant: '李强', guardian: '王强', startAt: '08:00', endAt: '12:00', riskLevel: '重大', status: '作业中', gasTest: '合格', linkedGdsCodes: ['GDS-1'], safetyMeasures: [] }],
  communicationTasks: [{ id: 'comm-1', eventId: 'evt-1', eventTitle: '泵区泄漏', receiver: '赵磊', receiverRole: '装置负责人', channel: 'App消息', sendTime: '08:00:03', deliveryStatus: '已送达', confirmStatus: '待确认', retryCount: 0, escalationLevel: 0 }],
} as unknown as DashboardData;

describe('warningEvidenceWorkflow', () => {
  test('按事件区域聚合监测、工艺、票证和人员证据', () => {
    const bundle = buildWarningEvidence(dashboard, event);
    expect(bundle.readings[0]).toMatchObject({ code: 'GDS-1', value: '38 %LEL' });
    expect(bundle.processes[0]).toMatchObject({ code: 'U1', value: '86% 负荷' });
    expect(bundle.permits).toHaveLength(1);
    expect(bundle.people.map((item) => item.name)).toEqual(expect.arrayContaining(['赵磊', '李强', '王强']));
    expect(getWarningEvidenceCount(bundle)).toBe(4);
  });

  test('核验证据写入核验状态和操作记录且不可重复', () => {
    const checked = verifyWarningEvidence(event, '监测数据', '赵磊', '2026-07-14 09:00:00');
    expect(checked.evidenceChecks).toHaveLength(1);
    expect(checked.operations?.[0]).toMatchObject({ type: '证据核验', detail: '监测数据已完成一致性核验' });
    expect(verifyWarningEvidence(checked, '监测数据', '赵磊', '2026-07-14 09:01:00')).toBe(checked);
  });

  test('确认事件和启动预案形成连续留痕', () => {
    const confirmed = confirmWarningEvent(event, '张伟', '2026-07-14 09:02:00');
    expect(confirmed.status).toBe('已确认');
    const processing = startWarningEmergency(confirmed, '张伟', '2026-07-14 09:03:00');
    expect(processing.status).toBe('处置中');
    expect(processing.operations?.map((item) => item.type)).toEqual(['事件确认', '预案启动']);
  });

  test('非法状态不重复确认或启动', () => {
    expect(confirmWarningEvent({ ...event, status: '监控中' }, '张伟', 'now').status).toBe('监控中');
    expect(startWarningEmergency(event, '张伟', 'now').status).toBe('待确认');
  });
});
