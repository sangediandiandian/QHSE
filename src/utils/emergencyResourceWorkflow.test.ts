import type { EmergencyResource } from '@/types/qhse';
import {
  addEmergencyResource,
  confirmEmergencyResourceArrival,
  dispatchEmergencyResource,
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
    }, 'res-2');
    expect(next[0]).toMatchObject({ availableQuantity: 2, quantity: '2 台', status: '待命', inspectionStatus: '即将到期' });
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
