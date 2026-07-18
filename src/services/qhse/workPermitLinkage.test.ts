/** @jest-environment node */

import { getHazardRiskUnits } from './hazards';
import { getTelemetryPoints, toGdsPoint } from './telemetry';
import { getWorkPermits } from './workPermits';
import { getWarningRules, getWarningSignals } from './warningRules';
import { getWorkPermitLinkageSnapshot } from './workPermitLinkage';

jest.mock('./hazards', () => ({ getHazardRiskUnits: jest.fn() }));
jest.mock('./telemetry', () => ({
  getTelemetryPoints: jest.fn(),
  toGdsPoint: jest.fn(),
}));
jest.mock('./workPermits', () => ({ getWorkPermits: jest.fn() }));
jest.mock('./warningRules', () => ({
  getWarningRules: jest.fn(),
  getWarningSignals: jest.fn(),
}));

const mock = (value: unknown) => value as jest.Mock;

describe('work permit linkage API snapshot', () => {
  beforeEach(() => jest.clearAllMocks());

  test('并行聚合票证、区域、GDS 点位、规则和预警信号', async () => {
    mock(getWorkPermits).mockResolvedValue([{ id: 'permit-1', status: '建议暂停' }]);
    mock(getHazardRiskUnits).mockResolvedValue([
      { areaId: 'area-02', areaName: '催化裂化装置' },
      { areaId: 'area-02', areaName: '催化裂化装置' },
    ]);
    mock(getTelemetryPoints).mockResolvedValue([
      {
        id: 'gds-101',
        code: 'GDS-101',
        source: 'GDS',
        name: '泵区探测器',
        areaId: 'area-02',
        areaName: '催化裂化装置',
        equipmentName: 'P-201A',
        metricKey: 'gasConcentration',
        unit: '%LEL',
        configuration: { gasType: '可燃气体', alarmLevel1: 25, alarmLevel2: 40 },
        currentMetrics: { gasConcentration: 42 },
        status: 'level2',
        onlineStatus: 'online',
        version: 2,
      },
    ]);
    mock(toGdsPoint).mockReturnValue({
      id: 'gds-101',
      currentValue: 42,
      alarmStatus: 'level2',
    });
    mock(getWarningRules).mockResolvedValue([{ id: 'rule-005', enabled: true }]);
    mock(getWarningSignals).mockResolvedValue([{ id: 'signal-1', level: 'critical' }]);

    await expect(getWorkPermitLinkageSnapshot()).resolves.toMatchObject({
      permits: [{ id: 'permit-1', status: '建议暂停' }],
      areas: [{ id: 'area-02', name: '催化裂化装置' }],
      gdsPoints: [{ id: 'gds-101', currentValue: 42, alarmStatus: 'level2' }],
      rules: [{ id: 'rule-005', enabled: true }],
      signals: [{ id: 'signal-1', level: 'critical' }],
    });
    expect(getTelemetryPoints).toHaveBeenCalledWith('GDS');
  });
});
