/** @jest-environment node */

import { ConflictException, ForbiddenException } from '@nestjs/common';
import { InMemoryWorkflowRepository } from './in-memory-workflow.repository';
import { WorkflowService } from './workflow.service';

function createService() {
  let sequence = 0;
  return new WorkflowService(new InMemoryWorkflowRepository(), {
    now: () => new Date('2026-07-15T08:00:00.000Z'),
    createId: () => `workflow-generated-${++sequence}`,
  });
}

const author = { actorId: 'user-qhse', actorName: '赵磊', roleCodes: ['qhse_manager'] };
const qhse = { actorId: 'user-qhse-2', actorName: '钱敏', roleCodes: ['qhse_manager'] };
const leader = { actorId: 'user-leader', actorName: '刘总', roleCodes: ['enterprise_leader'] };

const definition = {
  businessType: 'warning_rule',
  businessId: 'rule-001',
  title: '预警规则发布审批',
  steps: [
    { name: 'QHSE 会签', allowedRoleCodes: ['qhse_manager'] },
    { name: '企业负责人会签', allowedRoleCodes: ['enterprise_leader'] },
  ],
};

describe('WorkflowService', () => {
  test('创建有序审批实例并防止重复活动流程', async () => {
    const service = createService();
    const instance = await service.create(definition, author);
    expect(instance).toMatchObject({ status: '进行中', version: 1, createdById: 'user-qhse' });
    expect(instance.steps.map((step) => step.sequence)).toEqual([1, 2]);
    await expect(service.create(definition, author)).rejects.toBeInstanceOf(ConflictException);
  });

  test('按节点角色顺序审批并在末节点自动通过', async () => {
    const service = createService();
    const instance = await service.create(definition, author);
    const first = await service.approve(instance.id, '规则校验通过', 1, qhse);
    expect(first).toMatchObject({ status: '进行中', version: 2 });
    const completed = await service.approve(instance.id, '同意发布', 2, leader);
    expect(completed).toMatchObject({ status: '已通过', version: 3 });
    expect(completed.steps.map((step) => step.status)).toEqual(['已通过', '已通过']);
  });

  test('拒绝角色不匹配和旧版本覆盖', async () => {
    const service = createService();
    const instance = await service.create(definition, author);
    await expect(service.approve(instance.id, '越权', 1, leader)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.approve(instance.id, '旧版本', 9, qhse)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  test('驳回必须填写意见并终止流程', async () => {
    const service = createService();
    const instance = await service.create(definition, author);
    await expect(service.reject(instance.id, ' ', 1, qhse)).rejects.toBeInstanceOf(
      ConflictException,
    );
    const rejected = await service.reject(instance.id, '条件存在冲突', 1, qhse);
    expect(rejected).toMatchObject({ status: '已驳回', version: 2 });
  });

  test('仅发起人或管理员可撤回', async () => {
    const service = createService();
    const instance = await service.create(definition, author);
    await expect(service.withdraw(instance.id, 1, qhse)).rejects.toBeInstanceOf(ForbiddenException);
    const withdrawn = await service.withdraw(instance.id, 1, author);
    expect(withdrawn.status).toBe('已撤回');
  });
});
