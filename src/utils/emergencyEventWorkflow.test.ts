import type { EmergencyEvent } from '@/types/qhse';
import {
  addEmergencyEventEvidence,
  approveEmergencyEventClosure,
  createEmergencyClosureApproval,
  isEmergencyApprovalOverdue,
  isEmergencyEventActionAllowed,
  remindEmergencyClosureApproval,
  transitionEmergencyEvent,
} from './emergencyEventWorkflow';

const event: EmergencyEvent = {
  id: 'lifecycle-1', eventId: 'evt-1', code: 'E001', title: '测试事件', areaId: 'area-1',
  areaName: '测试区域', source: 'GDS', status: '响应中', responseLevel: 'III级', commander: '张伟',
  ownerDepartment: '运行部', startedAt: '09:00', updatedAt: '09:10', summary: '测试', operations: [],
};

describe('emergency event workflow', () => {
  it('响应中事件支持升级和降级并记录操作', () => {
    const upgraded = transitionEmergencyEvent(event, '升级响应', '陈涛', '09:20');
    expect(upgraded).toMatchObject({ status: '响应中', responseLevel: 'II级', updatedAt: '09:20' });
    expect(upgraded.operations[0]).toMatchObject({ action: '升级响应', fromLevel: 'III级', toLevel: 'II级' });
    expect(transitionEmergencyEvent(upgraded, '降级响应', '陈涛', '09:30').responseLevel).toBe('III级');
  });

  it('终止、申请关闭、审批关闭形成完整闭环', () => {
    const monitoring = transitionEmergencyEvent(event, '终止响应', '陈涛', '10:00');
    const pending = transitionEmergencyEvent(monitoring, '申请关闭', '陈涛', '10:30');
    const closed = transitionEmergencyEvent(pending, '审批关闭', '赵磊', '11:00');
    expect([monitoring.status, pending.status, closed.status]).toEqual(['监控中', '待关闭', '已关闭']);
    expect(closed.operations).toHaveLength(3);
  });

  it('非法状态迁移不修改事件', () => {
    expect(isEmergencyEventActionAllowed(event, '审批关闭')).toBe(false);
    expect(transitionEmergencyEvent(event, '审批关闭', '赵磊', '11:00')).toBe(event);
    expect(transitionEmergencyEvent({ ...event, responseLevel: 'I级' }, '升级响应', '陈涛', '11:00')).toEqual({ ...event, responseLevel: 'I级' });
  });

  it('申请关闭后生成有时限的审批任务', () => {
    const monitoring = transitionEmergencyEvent(event, '终止响应', '陈涛', '2026-07-14 09:00:00');
    const pending = transitionEmergencyEvent(monitoring, '申请关闭', '陈涛', '2026-07-14 10:00:00');
    const withApproval = createEmergencyClosureApproval(pending, '陈涛', '赵磊', '2026-07-14 10:00:00');
    expect(withApproval.closureApproval).toMatchObject({ status: '待审批', dueAt: '2026-07-14 14:00:00', reminderCount: 0 });
    expect(isEmergencyApprovalOverdue(withApproval, '2026-07-14 14:00:01')).toBe(true);
  });

  it('超时审批可催办并留下次数和时间', () => {
    const pending = createEmergencyClosureApproval({ ...event, status: '待关闭' }, '陈涛', '赵磊', '2026-07-14 10:00:00');
    const reminded = remindEmergencyClosureApproval(pending, '2026-07-14 14:10:00');
    expect(reminded.closureApproval).toMatchObject({ reminderCount: 1, lastReminderAt: '2026-07-14 14:10:00' });
  });

  it('关闭审批要求证据并生成签名', () => {
    const pending = createEmergencyClosureApproval({ ...event, status: '待关闭' }, '陈涛', '赵磊', '2026-07-14 10:00:00');
    expect(() => approveEmergencyEventClosure(pending, '赵磊', '同意关闭', '2026-07-14 11:00:00')).toThrow('至少归档一项事件证据');
    const withEvidence = addEmergencyEventEvidence(pending, { name: '现场复查照片', category: '现场照片', uploader: '陈涛', note: '风险已解除' }, 'evidence-1', '2026-07-14 10:30:00', 'sha256:abc');
    const closed = approveEmergencyEventClosure(withEvidence, '赵磊', '同意关闭', '2026-07-14 11:00:00');
    expect(closed.status).toBe('已关闭');
    expect(closed.closureApproval).toMatchObject({ status: '已通过', opinion: '同意关闭' });
    expect(closed.closureApproval?.signature).toContain('电子签名');
  });
});
