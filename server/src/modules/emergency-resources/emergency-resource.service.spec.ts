import { BadRequestException, ConflictException } from '@nestjs/common';
import { InMemoryEmergencyResourceRepository } from './in-memory-emergency-resource.repository';
import { EmergencyResourceService } from './emergency-resource.service';
const actor = { actorId: 'user-dispatcher', actorName: '陈涛' };
function service() {
  let n = 0;
  return new EmergencyResourceService(new InMemoryEmergencyResourceRepository(), {
    now: () => new Date('2026-07-15T08:00:00.000Z'),
    id: () => `generated-${++n}`,
  });
}
describe('EmergencyResourceService', () => {
  it('按 FEFO 分配有效批次并在归还后恢复库存', async () => {
    const s = service();
    const dispatched = await s.dispatch(
      'res-002',
      { eventName: '泄漏事件', destination: 'FCC 泵区', quantity: 5, expectedVersion: 1 },
      actor,
    );
    expect(dispatched.availableQuantity).toBe(7);
    expect(dispatched.dispatches[0].batchAllocations).toEqual([
      { batchId: 'batch-002-a', batchNo: 'SCBA-202501', quantity: 4 },
      { batchId: 'batch-002-b', batchNo: 'SCBA-202601', quantity: 1 },
    ]);
    const arrived = await s.arrive('res-002', dispatched.dispatches[0].id, { expectedVersion: 2 });
    const returned = await s.return('res-002', dispatched.dispatches[0].id, { expectedVersion: 3 });
    expect(arrived.status).toBe('已到位');
    expect(returned).toMatchObject({ status: '待命', availableQuantity: 12, version: 4 });
  });
  it('过期批次不计入可调库存', async () => {
    const s = service();
    await s.addBatch('res-001', {
      batchNo: 'EXPIRED',
      quantity: 10,
      receivedAt: '2025-01-01',
      expiryDate: '2026-01-01',
      expectedVersion: 1,
    });
    await expect(
      s.dispatch(
        'res-001',
        { eventName: '火灾', destination: '罐区', quantity: 3, expectedVersion: 2 },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('需要维护资源禁止调拨', async () => {
    const s = service();
    await expect(
      s.dispatch(
        'res-003',
        { eventName: '火灾', destination: '罐区', quantity: 1, expectedVersion: 1 },
        actor,
      ),
    ).rejects.toMatchObject({ response: { code: 'RESOURCE_MAINTENANCE_REQUIRED' } });
  });
  it('巡检可信操作人和并发版本受服务端控制', async () => {
    const s = service();
    const inspected = await s.inspect(
      'res-003',
      { result: '检查合格', nextInspection: '2026-08-15', note: '维修完成', expectedVersion: 1 },
      actor,
    );
    expect(inspected.inspectionRecords[0]).toMatchObject({
      inspectorId: 'user-dispatcher',
      inspector: '陈涛',
    });
    await expect(
      s.inspect(
        'res-003',
        { result: '检查合格', nextInspection: '2026-09-15', note: '旧版本', expectedVersion: 1 },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
