import { TelemetryStreamService } from './telemetry-stream.service';
import type { TelemetryIngestOutcome } from './telemetry.types';

const outcome = (id: string, areaId = 'area-02'): TelemetryIngestOutcome => ({
  created: true,
  outOfOrder: false,
  clockDriftMs: 100,
  point: {
    id: 'gds-101',
    code: 'GDS-101',
    source: 'GDS',
    name: '探测器',
    areaId,
    areaName: '催化裂化装置',
    equipmentName: 'P-201A',
    metricKey: 'gasConcentration',
    unit: '%LEL',
    configuration: {},
    currentMetrics: { gasConcentration: 42 },
    status: 'level2',
    onlineStatus: 'online',
    version: 2,
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T09:00:00.000Z',
  },
  sample: {
    id,
    pointId: 'gds-101',
    source: 'GDS',
    occurredAt: '2026-07-15T08:59:00.000Z',
    metrics: { gasConcentration: 42 },
    quality: 'good',
    createdAt: '2026-07-15T09:00:00.000Z',
  },
});

describe('TelemetryStreamService', () => {
  it('发布单调序号并按游标和数据范围补传', () => {
    const service = new TelemetryStreamService();
    const listener = jest.fn();
    const unsubscribe = service.subscribe(listener);
    expect(service.publish(outcome('sample-1')).sequence).toBe(1);
    expect(service.publish(outcome('sample-2', 'area-04')).sequence).toBe(2);
    expect(service.replay(0, (event) => event.point.areaId === 'area-02')).toHaveLength(1);
    expect(service.replay(1, () => true).map((event) => event.sequence)).toEqual([2]);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    service.publish(outcome('sample-3'));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
