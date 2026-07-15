import { InMemoryCommunicationRepository } from './in-memory-communication.repository';
import { CommunicationService } from './communication.service';
const actor = { actorId: 'user-dispatcher', actorName: '陈涛' };
const options = {
  now: () => new Date('2026-07-15T08:32:00.000Z'),
  id: (() => {
    let id = 0;
    return () => `generated-${++id}`;
  })(),
};
describe('CommunicationService', () => {
  it('按重呼、班长、指挥链逐级升级并阻止越级', async () => {
    const service = new CommunicationService(new InMemoryCommunicationRepository(), options);
    const l1 = await service.escalate('evt-001', { expectedVersion: 1 }, actor);
    expect(l1.tasks[0]).toMatchObject({ channel: '电话语音', retryCount: 1, escalationLevel: 1 });
    const l2 = await service.escalate('evt-001', { expectedVersion: 2 }, actor);
    expect(l2.tasks[0]).toMatchObject({ receiverRole: '当班班长', escalationLevel: 2 });
    const l3 = await service.escalate('evt-001', { expectedVersion: 3 }, actor);
    expect(l3.tasks.filter((task) => task.escalationLevel === 3)).toHaveLength(2);
    await expect(service.escalate('evt-001', { expectedVersion: 4 }, actor)).rejects.toMatchObject({
      response: { code: 'COMMUNICATION_ESCALATION_LIMIT' },
    });
  });
  it('记录可信确认人并停止后续升级', async () => {
    const service = new CommunicationService(new InMemoryCommunicationRepository(), options);
    const result = await service.confirm('comm-001', { expectedVersion: 1 }, actor);
    expect(result.tasks.find((task) => task.id === 'comm-001')).toMatchObject({
      confirmStatus: '已确认',
      confirmedBy: '陈涛',
    });
    await expect(service.escalate('evt-001', { expectedVersion: 2 }, actor)).rejects.toMatchObject({
      response: { code: 'COMMUNICATION_ALREADY_CONFIRMED' },
    });
  });
  it('失败回执自动创建重试任务并限制重试次数', async () => {
    const service = new CommunicationService(new InMemoryCommunicationRepository(), options);
    const failed = await service.receipt('comm-001', {
      deliveryStatus: '失败',
      expectedVersion: 1,
    });
    expect(failed.tasks[0]).toMatchObject({ deliveryStatus: '发送中', retryCount: 1 });
    const second = await service.receipt(failed.tasks[0].id, {
      deliveryStatus: '失败',
      expectedVersion: 2,
    });
    expect(second.tasks[0]).toMatchObject({ retryCount: 2 });
    const final = await service.receipt(second.tasks[0].id, {
      deliveryStatus: '失败',
      expectedVersion: 3,
    });
    expect(final.tasks).toHaveLength(second.tasks.length);
  });
  it('拒绝旧版本覆盖', async () => {
    const service = new CommunicationService(new InMemoryCommunicationRepository(), options);
    await service.escalate('evt-001', { expectedVersion: 1 }, actor);
    await expect(service.escalate('evt-001', { expectedVersion: 1 }, actor)).rejects.toMatchObject({
      response: { code: 'VERSION_CONFLICT' },
    });
  });
});
