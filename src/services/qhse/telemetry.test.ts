import type { TelemetryPoint } from '@/types/qhse';
import { toGdsPoint, toMesTag, toVocPoint } from './telemetry';
const base: TelemetryPoint = {
  id: 'point-1',
  code: 'P-1',
  source: 'GDS',
  name: '点位',
  areaId: 'area-1',
  areaName: '一区',
  equipmentName: '设备',
  metricKey: 'value',
  unit: 'ppm',
  configuration: {},
  currentMetrics: { value: 10 },
  status: 'normal',
  onlineStatus: 'online',
  version: 1,
};
describe('telemetry view mapping', () => {
  it('映射 GDS 点位和趋势', () => {
    expect(
      toGdsPoint({
        ...base,
        configuration: { gasType: '硫化氢', alarmLevel1: 10, alarmLevel2: 20 },
      }),
    ).toMatchObject({
      currentValue: 10,
      gasType: '硫化氢',
      alarmLevel1: 10,
      alarmLevel2: 20,
      trend: expect.arrayContaining([10]),
    });
  });
  it('映射 VOC 点位和设施标识', () => {
    expect(
      toVocPoint({
        ...base,
        source: 'VOC',
        equipmentName: 'RTO-01',
        unit: 'mg/m³',
        configuration: { pointType: '有组织排口', pollutantType: '非甲烷总烃', limitValue: 60 },
        currentMetrics: { value: 56, flow: 12000 },
        status: 'warning',
      }),
    ).toMatchObject({ currentValue: 56, limitValue: 60, flowValue: 12000, facilityId: 'RTO-01' });
  });
  it('映射 MES 上下限和工艺步骤', () => {
    expect(
      toMesTag({
        ...base,
        source: 'MES',
        configuration: {
          processStep: '进料',
          parameterType: '压力',
          lowerLimit: 0.5,
          upperLimit: 1.2,
        },
        currentMetrics: { value: 0.82 },
        unit: 'MPa',
      }),
    ).toMatchObject({ currentValue: 0.82, processStep: '进料', lowerLimit: 0.5, upperLimit: 1.2 });
  });
});
