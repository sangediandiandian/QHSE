/** @jest-environment node */

import { ConflictException } from '@nestjs/common';
import { InMemoryWorkflowRepository } from '../workflows/in-memory-workflow.repository';
import { WorkflowService } from '../workflows/workflow.service';
import { InMemoryWarningRuleRepository } from './in-memory-warning-rule.repository';
import { WarningRuleService } from './warning-rule.service';

function createService() {
  let sequence = 0;
  const ids = () => `generated-${++sequence}`;
  const options = { now: () => new Date('2026-07-15T08:00:00.000Z'), createId: ids };
  return new WarningRuleService(
    new InMemoryWarningRuleRepository(),
    new WorkflowService(new InMemoryWorkflowRepository(), options),
    options,
  );
}

const author = { actorId: 'user-qhse', actorName: '赵磊', roleCodes: ['qhse_manager'] };
const qhseReviewer = { actorId: 'user-qhse-2', actorName: '钱敏', roleCodes: ['qhse_manager'] };
const dispatcher = {
  actorId: 'user-dispatcher',
  actorName: '陈涛',
  roleCodes: ['production_dispatcher'],
};

const draft = {
  code: 'GDS_CUSTOM_01',
  name: '泵区可燃气体趋势规则',
  source: 'GDS' as const,
  scenario: 'gds-trend' as const,
  level: 'high' as const,
  scope: '催化裂化装置泵区',
  condition: 'GDS.currentValue >= 25',
  duration: '连续 3 分钟',
  notifyTargets: ['岗位操作员', '生产调度'],
  description: '泵区趋势提前预警',
  expression: [
    {
      metric: 'GDS.currentValue',
      operator: '>=' as const,
      threshold: '25',
      connector: 'AND' as const,
    },
  ],
  rolloutPercentage: 25 as const,
};

describe('WarningRuleService', () => {
  test('创建草稿并完成双人会签发布', async () => {
    const service = createService();
    const created = await service.createDraft(draft, author);
    const submitted = await service.submit(created.id, { expectedRevision: 1 }, author);
    expect(submitted).toMatchObject({ publishStatus: '待审批', revision: 2 });
    expect(submitted.approvalSteps).toHaveLength(2);

    const first = await service.approve(
      created.id,
      { opinion: 'QHSE 校验通过', expectedRevision: 2 },
      qhseReviewer,
    );
    expect(first).toMatchObject({ publishStatus: '待审批', revision: 3 });
    const published = await service.approve(
      created.id,
      { opinion: '同意发布', expectedRevision: 3 },
      dispatcher,
    );
    expect(published).toMatchObject({
      publishStatus: '已发布',
      version: 1,
      revision: 4,
      enabled: true,
      draft: undefined,
    });
    expect(published.versions[0]).toMatchObject({ version: 1, publisherId: 'user-dispatcher' });
  });

  test('阻止与启用规则作用域和表达式重复的草稿提交', async () => {
    const service = createService();
    const created = await service.createDraft(
      {
        ...draft,
        code: 'GDS_DUPLICATE_01',
        scope: '全厂 GDS 可燃气体测点',
        condition: 'duplicate',
        expression: [
          {
            metric: 'GDS.currentValue',
            operator: '>=' as const,
            threshold: '50',
            connector: 'AND' as const,
          },
        ],
      },
      author,
    );
    await expect(service.submit(created.id, { expectedRevision: 1 }, author)).rejects.toMatchObject(
      { response: { code: 'WARNING_RULE_CONFLICT' } },
    );
  });

  test('驳回后保留草稿并允许继续编辑', async () => {
    const service = createService();
    const created = await service.createDraft(draft, author);
    await service.submit(created.id, { expectedRevision: 1 }, author);
    await service.approve(created.id, { opinion: '初审通过', expectedRevision: 2 }, qhseReviewer);
    const rejected = await service.reject(
      created.id,
      { opinion: '灰度范围需调整', expectedRevision: 3 },
      dispatcher,
    );
    expect(rejected).toMatchObject({ publishStatus: '草稿', revision: 4 });
    expect(rejected.draft).toBeDefined();
  });

  test('历史版本回滚生成草稿且启停保持幂等', async () => {
    const service = createService();
    const rolledBack = await service.rollback('rule-001', { version: 1, expectedRevision: 1 });
    expect(rolledBack).toMatchObject({ publishStatus: '草稿', version: 1, revision: 2 });
    const toggled = await service.toggle('rule-002', { enabled: false, expectedRevision: 1 });
    expect(toggled).toMatchObject({ enabled: false, revision: 2 });
    const unchanged = await service.toggle('rule-002', { enabled: false, expectedRevision: 1 });
    expect(unchanged).toMatchObject({ enabled: false, revision: 2 });
  });

  test('拒绝重复编码和旧修订覆盖', async () => {
    const service = createService();
    await expect(
      service.createDraft({ ...draft, code: 'GDS_L2_01' }, author),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.saveDraft('rule-001', { ...draft, code: 'GDS_L2_01', expectedRevision: 9 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
