import type { WarningRule, WarningRuleDraftInput } from '@/types/qhse';
import {
  getWarningRuleDisplayConfig,
  approveWarningRuleStep,
  findWarningRuleConflicts,
  publishWarningRule,
  rollbackWarningRule,
  saveWarningRuleDraft,
  submitWarningRuleForApproval,
} from './warningRuleWorkflow';

const config: WarningRuleDraftInput = {
  code: 'GDS_TEST_01', name: '测试规则', source: 'GDS', scenario: 'gds-level2', level: 'high',
  scope: '全厂', condition: '测量值 ≥ 25', duration: '即时触发', notifyTargets: ['岗位人员'], description: '测试描述',
};

const published: WarningRule = {
  id: 'rule-1', ...config, enabled: true, triggerCount: 2, publishStatus: '已发布', version: 1,
  versions: [{ ...config, version: 1, publishedAt: '2026-07-01 09:00:00', publisher: '赵磊' }],
};

describe('warning rule workflow', () => {
  it('新建规则保持草稿状态且不启用', () => {
    const created = saveWarningRuleDraft([], 'rule-new', config)[0];
    expect(created).toMatchObject({ code: config.code, publishStatus: '草稿', version: 0, enabled: false });
    expect(created.draft).toMatchObject({ condition: config.condition });
  });

  it('编辑已发布规则不会立即覆盖运行版本', () => {
    const edited = saveWarningRuleDraft([published], published.id, { ...config, condition: '测量值 ≥ 30' })[0];
    expect(edited.condition).toBe('测量值 ≥ 25');
    expect(getWarningRuleDisplayConfig(edited).condition).toBe('测量值 ≥ 30');
    expect(edited.publishStatus).toBe('草稿');
  });

  it('审批发布生成新版本并使草稿生效', () => {
    const edited = saveWarningRuleDraft([published], published.id, { ...config, condition: '测量值 ≥ 30' })[0];
    let submitted = submitWarningRuleForApproval(edited);
    submitted = approveWarningRuleStep(submitted, '赵磊', '2026-07-13 09:58:00');
    submitted = approveWarningRuleStep(submitted, '陈涛', '2026-07-13 09:59:00');
    const next = publishWarningRule(submitted, '2026-07-13 10:00:00', '赵磊、陈涛');
    expect(next).toMatchObject({ condition: '测量值 ≥ 30', publishStatus: '已发布', version: 2 });
    expect(next.versions).toHaveLength(2);
    expect(next.draft).toBeUndefined();
  });

  it('回滚历史版本只生成草稿，不改变当前运行版本', () => {
    let submitted = submitWarningRuleForApproval(saveWarningRuleDraft([published], published.id, { ...config, condition: '测量值 ≥ 30' })[0]);
    submitted = approveWarningRuleStep(submitted, '赵磊', '09:58');
    submitted = approveWarningRuleStep(submitted, '陈涛', '09:59');
    const v2 = publishWarningRule(
      submitted,
      '2026-07-13 10:00:00', '赵磊',
    );
    const rolledBack = rollbackWarningRule(v2, 1);
    expect(rolledBack.condition).toBe('测量值 ≥ 30');
    expect(rolledBack.draft?.condition).toBe('测量值 ≥ 25');
    expect(rolledBack.publishStatus).toBe('草稿');
  });

  it('同来源、范围和表达式的运行规则会被识别为冲突', () => {
    expect(findWarningRuleConflicts([published], config, 'other')).toHaveLength(1);
    expect(findWarningRuleConflicts([published], { ...config, scope: '其他区域' }, 'other')).toHaveLength(0);
  });
});
