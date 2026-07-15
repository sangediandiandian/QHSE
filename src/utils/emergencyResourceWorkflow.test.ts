import type { EmergencyResource } from '@/types/qhse';
import {
  addEmergencyResourceBatch,
  addEmergencyResource,
  confirmEmergencyResourceArrival,
  dispatchEmergencyResource,
  getDispatchableEmergencyResourceQuantity,
  getEmergencyResourceBatchStatus,
  inspectEmergencyResource,
  returnEmergencyResource,
} from './emergencyResourceWorkflow';

const resource: EmergencyResource = {
  id: 'res-1', code: 'SCBA-01', name: '空气呼吸器', type: '气防', quantity: '10 套',
  totalQuantity: 10, availableQuantity: 10, unit: '套', location: '气防柜', eta: '5 分钟', status: '待命',
  owner: '刘洋', contact: '6218', lastInspection: '2026-07-01', nextInspection: '2026-08-01',
  inspectionStatus: '检查合格', dispatches: [], inspectionRecords: [],
};

const dispatchInput = {
  id: 'dispatch-1', eventName: '泵区泄漏', destination: 'FCC 泵区', quantity: 3,
  operator: '赵磊', dispatchedAt: '2026-07-13 10:00:00',
};

describe('emergencyResourceWorkflow', () => {
  test('新增资源时全部库存可用并等待首次检查', () => {
    const next = addEmergencyResource([], {
      code: 'AED-01', name: 'AED', type: '医疗', totalQuantity: 2, unit: '台', location: '医务室',
      eta: '6 分钟', owner: '林晓', contact: '6120', nextInspection: '2026-08-01',
      batchNo: 'AED-202607', receivedAt: '2026-07-01', expiryDate: '2027-07-01',
    }, 'res-2');
    expect(next[0]).toMatchObject({ availableQuantity: 2, quantity: '2 台', status: '待命', inspectionStatus: '即将到期' });
    expect(next[0].batches).toEqual([expect.objectContaining({ batchNo: 'AED-202607', quantity: 2, availableQuantity: 2 })]);
  });

  test('根据有效期识别正常、即将到期和已过期批次', () => {
    const batch = { id: 'batch-1', batchNo: 'B-01', quantity: 2, availableQuantity: 2, receivedAt: '2026-06-01', expiryDate: '2026-08-01' };
    expect(getEmergencyResourceBatchStatus({ ...batch, expiryDate: '2026-08-13' }, '2026-07-14')).toBe('即将到期');
    expect(getEmergencyResourceBatchStatus({ ...batch, expiryDate: '2026-08-14' }, '2026-07-14')).toBe('正常');
    expect(getEmergencyResourceBatchStatus({ ...batch, expiryDate: '2026-07-13' }, '2026-07-14')).toBe('已过期');
  });

  test('新增批次增加库存并禁止重复批号', () => {
    const next = addEmergencyResourceBatch(resource, {
      batchNo: 'SCBA-202607', quantity: 4, receivedAt: '2026-07-14', expiryDate: '2027-07-14',
    }, 'batch-1');
    expect(next).toMatchObject({ totalQuantity: 14, availableQuantity: 14, quantity: '14 套' });
    expect(getDispatchableEmergencyResourceQuantity(next, '2026-07-14')).toBe(14);
    expect(() => addEmergencyResourceBatch(next, {
      batchNo: 'scba-202607', quantity: 1, receivedAt: '2026-07-14', expiryDate: '2027-07-14',
    }, 'batch-2')).toThrow('批号已存在');
  });

  test('调拨按有效期先到先出并跳过过期批次', () => {
    const withBatches: EmergencyResource = {
      ...resource,
      totalQuantity: 8,
      availableQuantity: 8,
      quantity: '8 套',
      batches: [
        { id: 'expired', batchNo: 'EXPIRED', quantity: 2, availableQuantity: 2, receivedAt: '2025-01-01', expiryDate: '2026-07-01' },
        { id: 'later', batchNo: 'LATER', quantity: 3, availableQuantity: 3, receivedAt: '2026-01-01', expiryDate: '2027-03-01' },
        { id: 'earlier', batchNo: 'EARLIER', quantity: 3, availableQuantity: 3, receivedAt: '2026-01-01', expiryDate: '2026-12-01' },
      ],
    };
    expect(getDispatchableEmergencyResourceQuantity(withBatches, '2026-07-14')).toBe(6);
    const next = dispatchEmergencyResource(withBatches, { ...dispatchInput, quantity: 4 });
    expect(next.dispatches[0].batchAllocations).toEqual([
      { batchId: 'earlier', batchNo: 'EARLIER', quantity: 3 },
      { batchId: 'later', batchNo: 'LATER', quantity: 1 },
    ]);
    expect(next.batches?.map((item) => item.availableQuantity)).toEqual([2, 2, 0]);
  });

  test('有效批次库存不足时禁止调拨，归还时恢复原批次库存', () => {
    const withBatches: EmergencyResource = {
      ...resource,
      totalQuantity: 5,
      availableQuantity: 5,
      quantity: '5 套',
      batches: [
        { id: 'expired', batchNo: 'EXPIRED', quantity: 3, availableQuantity: 3, receivedAt: '2025-01-01', expiryDate: '2026-07-01' },
        { id: 'valid', batchNo: 'VALID', quantity: 2, availableQuantity: 2, receivedAt: '2026-01-01', expiryDate: '2027-01-01' },
      ],
    };
    expect(() => dispatchEmergencyResource(withBatches, { ...dispatchInput, quantity: 3 })).toThrow('有效批次库存不足');
    const dispatched = dispatchEmergencyResource(withBatches, { ...dispatchInput, quantity: 2 });
    const returned = returnEmergencyResource(dispatched, 'dispatch-1', '2026-07-13 11:00:00');
    expect(returned.batches?.find((item) => item.id === 'valid')?.availableQuantity).toBe(2);
    expect(returned.availableQuantity).toBe(5);
  });

  test('调拨占用可用库存并形成记录', () => {
    const next = dispatchEmergencyResource(resource, dispatchInput);
    expect(next).toMatchObject({ availableQuantity: 7, status: '调度中' });
    expect(next.dispatches[0]).toMatchObject({ quantity: 3, status: '调度中' });
  });

  test('超库存或需要维护时禁止调拨', () => {
    expect(() => dispatchEmergencyResource(resource, { ...dispatchInput, quantity: 11 })).toThrow('调拨数量超出可用库存');
    expect(() => dispatchEmergencyResource({ ...resource, inspectionStatus: '需要维护' }, dispatchInput)).toThrow('需要维护的资源不能调拨');
  });

  test('到位与归还更新记录并释放库存', () => {
    const dispatched = dispatchEmergencyResource(resource, dispatchInput);
    const arrived = confirmEmergencyResourceArrival(dispatched, 'dispatch-1', '2026-07-13 10:05:00');
    expect(arrived).toMatchObject({ status: '已到位', eta: '已到场' });
    const returned = returnEmergencyResource(arrived, 'dispatch-1', '2026-07-13 11:00:00');
    expect(returned).toMatchObject({ status: '待命', availableQuantity: 10 });
    expect(returned.eta).toBe('5 分钟');
    expect(returned.dispatches[0].status).toBe('已归还');
  });

  test('巡检更新检查状态并追加记录', () => {
    const next = inspectEmergencyResource(resource, {
      id: 'inspection-1', inspector: '王强', inspectedAt: '2026-07-13 09:00:00',
      result: '需要维护', nextInspection: '2026-07-20', note: '气瓶压力不足',
    });
    expect(next).toMatchObject({ lastInspection: '2026-07-13', nextInspection: '2026-07-20', inspectionStatus: '需要维护' });
    expect(next.inspectionRecords).toHaveLength(1);
  });
});
