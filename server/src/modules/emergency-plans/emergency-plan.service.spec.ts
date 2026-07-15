import { ConflictException } from '@nestjs/common';
import { InMemoryWorkflowRepository } from '../workflows/in-memory-workflow.repository';
import { WorkflowService } from '../workflows/workflow.service';
import { InMemoryEmergencyPlanRepository } from './in-memory-emergency-plan.repository';
import { EmergencyPlanService } from './emergency-plan.service';
const qhse = { actorId: 'qhse-author', actorName: '赵磊', roleCodes: ['qhse_manager'] };
const reviewer = { actorId: 'qhse-reviewer', actorName: '钱敏', roleCodes: ['qhse_manager'] };
const dispatcher = {
  actorId: 'dispatcher',
  actorName: '陈涛',
  roleCodes: ['production_dispatcher'],
};
const input = {
  code: 'PLAN-NEW-01',
  name: '新预案',
  category: '专项应急预案' as const,
  eventType: '泄漏',
  applicableArea: '全厂',
  medium: '可燃气',
  responseLevel: 'III级' as const,
  triggerRule: '达到预警阈值',
  notificationTargets: ['调度'],
  steps: ['撤离'],
  resources: ['气防车'],
  effectiveDate: '2026-08-01',
  expiryDate: '2027-07-31',
  ownerDepartment: 'QHSE',
};
function service() {
  let n = 0;
  const now = () => new Date('2026-07-15T08:00:00.000Z');
  return new EmergencyPlanService(
    new InMemoryEmergencyPlanRepository(),
    new WorkflowService(new InMemoryWorkflowRepository(), {
      now,
      createId: () => `workflow-${++n}`,
    }),
    { now, id: () => `id-${++n}` },
  );
}
describe('EmergencyPlanService', () => {
  it('草稿经双人会签发布不可变版本', async () => {
    const s = service();
    const draft = await s.save(undefined, input);
    const pending = await s.submit(draft.id, { expectedRevision: 1 }, qhse);
    const first = await s.approve(draft.id, { expectedRevision: 2 }, reviewer);
    const published = await s.approve(draft.id, { expectedRevision: 3 }, dispatcher);
    expect(pending.publishStatus).toBe('待评审');
    expect(first.reviewSteps?.[0].status).toBe('已通过');
    expect(published).toMatchObject({ publishStatus: '已发布', version: 'V1.0', revision: 4 });
    expect(published.versions).toHaveLength(1);
  });
  it('同一账号不能完成两个会签节点', async () => {
    const s = service();
    const dualRole = { ...reviewer, roleCodes: ['qhse_manager', 'production_dispatcher'] };
    const draft = await s.save(undefined, input);
    await s.submit(draft.id, { expectedRevision: 1 }, qhse);
    await s.approve(draft.id, { expectedRevision: 2 }, dualRole);
    await expect(s.approve(draft.id, { expectedRevision: 3 }, dualRole)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it('历史版本回滚只生成草稿', async () => {
    const s = service();
    const rolled = await s.rollback('tpl-001', { version: 'V3.2', expectedRevision: 1 });
    expect(rolled).toMatchObject({ publishStatus: '草稿', version: 'V3.2', revision: 2 });
    expect(rolled.draft?.name).toContain('可燃气体');
  });
  it('演练从计划到复盘闭环', async () => {
    const s = service();
    const planned = await s.addDrill('tpl-001', {
      title: '桌面演练',
      type: '桌面推演',
      plannedAt: '2026-08-01T09:00',
      location: '调度室',
      leader: '赵磊',
      participants: ['生产调度'],
      expectedRevision: 1,
    });
    const drill = planned.drills.at(-1)!;
    const started = await s.startDrill(planned.id, drill.id, { expectedRevision: 2 });
    const completed = await s.recordDrill(planned.id, drill.id, {
      score: 90,
      summary: '达到目标',
      issues: ['通信延迟'],
      expectedRevision: 3,
    });
    expect(started.drills.at(-1)?.status).toBe('待复盘');
    expect(completed.drills.at(-1)).toMatchObject({ status: '已完成', score: 90 });
  });
});
