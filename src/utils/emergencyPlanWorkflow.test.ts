import type { EmergencyPlanDraftInput, EmergencyPlanTemplate } from '@/types/qhse';
import {
  addEmergencyDrill,
  approveEmergencyPlanReviewStep,
  compareEmergencyPlanConfigs,
  getEmergencyPlanExpiryState,
  publishEmergencyPlan,
  recordEmergencyDrill,
  rollbackEmergencyPlan,
  saveEmergencyPlanDraft,
  startEmergencyDrill,
  submitEmergencyPlanForReview,
} from './emergencyPlanWorkflow';

const config: EmergencyPlanDraftInput = {
  code: 'PLAN-01', name: '泄漏处置预案', category: '现场处置方案', eventType: '泄漏',
  applicableArea: '催化裂化装置', medium: '可燃气体', responseLevel: 'II级', triggerRule: '达到二级报警',
  notificationTargets: ['岗位人员'], steps: ['停止作业'], resources: ['空气呼吸器'],
  effectiveDate: '2026-07-01', expiryDate: '2027-06-30', ownerDepartment: '生产运行部',
};

const published: EmergencyPlanTemplate = {
  id: 'plan-1', ...config, version: 'V2.3', status: '生效中', publishStatus: '已发布',
  versions: [{ ...config, version: 'V2.3', publishedAt: '2026-07-01 09:00:00', publisher: '赵磊' }],
};

describe('emergency plan workflow', () => {
  it('新建预案保持未生效草稿', () => {
    expect(saveEmergencyPlanDraft([], 'plan-new', config)[0]).toMatchObject({ version: '未发布', status: '已停用', publishStatus: '草稿' });
  });

  it('编辑不会覆盖当前生效版本', () => {
    const edited = saveEmergencyPlanDraft([published], published.id, { ...config, triggerRule: '连续两点报警' })[0];
    expect(edited.triggerRule).toBe('达到二级报警');
    expect(edited.draft?.triggerRule).toBe('连续两点报警');
  });

  it('评审发布生成递增版本', () => {
    const edited = saveEmergencyPlanDraft([published], published.id, { ...config, triggerRule: '连续两点报警' })[0];
    const submitted = submitEmergencyPlanForReview(edited);
    const firstApproved = approveEmergencyPlanReviewStep(submitted, '2026-07-13 09:00:00');
    expect(publishEmergencyPlan(firstApproved, '2026-07-13 10:00:00', '赵磊 / 陈涛')).toBe(firstApproved);
    const next = publishEmergencyPlan(approveEmergencyPlanReviewStep(firstApproved, '2026-07-13 10:00:00'), '2026-07-13 10:00:00', '赵磊 / 陈涛');
    expect(next).toMatchObject({ version: 'V2.4', publishStatus: '已发布', triggerRule: '连续两点报警' });
    expect(next.versions).toHaveLength(2);
  });

  it('历史版本回滚只生成草稿', () => {
    const submitted = submitEmergencyPlanForReview(saveEmergencyPlanDraft([published], published.id, { ...config, triggerRule: '连续两点报警' })[0]);
    const approved = approveEmergencyPlanReviewStep(approveEmergencyPlanReviewStep(submitted, '2026-07-13 09:00:00'), '2026-07-13 10:00:00');
    const next = publishEmergencyPlan(approved, '2026-07-13', '赵磊 / 陈涛');
    const rolledBack = rollbackEmergencyPlan(next, 'V2.3');
    expect(rolledBack.triggerRule).toBe('连续两点报警');
    expect(rolledBack.draft?.triggerRule).toBe('达到二级报警');
  });

  it('识别临期和过期预案', () => {
    expect(getEmergencyPlanExpiryState({ ...published, expiryDate: '2026-08-15' }, '2026-07-13')).toBe('即将到期');
    expect(getEmergencyPlanExpiryState({ ...published, expiryDate: '2026-07-01' }, '2026-07-13')).toBe('已过期');
  });

  it('对比预案版本内容差异', () => {
    expect(compareEmergencyPlanConfigs(config, {
      ...config,
      triggerRule: '连续两点报警',
      resources: ['空气呼吸器', '堵漏工具'],
    })).toEqual([
      { key: 'triggerRule', label: '触发规则', before: '达到二级报警', after: '连续两点报警' },
      { key: 'resources', label: '资源清单', before: '空气呼吸器', after: '空气呼吸器、堵漏工具' },
    ]);
  });

  it('演练从计划流转至复盘完成', () => {
    const scheduled = addEmergencyDrill(published, {
      title: '泄漏专项演练', type: '专项演练', plannedAt: '2026-08-01 09:00', location: 'FCC 泵区',
      leader: '赵磊', participants: ['生产运行部', '消防气防中心'],
    }, 'drill-1');
    const started = startEmergencyDrill(scheduled, 'drill-1', '2026-08-01 09:05:00');
    const completed = recordEmergencyDrill(started, 'drill-1', { score: 92, summary: '协同顺畅', issues: ['警戒带布设较慢'] }, '2026-08-01 10:00:00');
    expect(completed.drills?.[0]).toMatchObject({ status: '已完成', score: 92, summary: '协同顺畅' });
  });
});
