import { InMemoryTelemetryRepository } from './in-memory-telemetry.repository';
import { TelemetryService } from './telemetry.service';
const warnings = {
  evaluate: jest.fn(async () => ({
    evaluatedRuleCount: 1,
    triggeredSignals: [],
    suppressedRuleIds: [],
    linkedPermitIds: [],
  })),
};
describe('TelemetryService', () => {
  beforeEach(() => warnings.evaluate.mockClear());
  const service = () =>
    new TelemetryService(
      new InMemoryTelemetryRepository(),
      warnings as never,
      () => new Date('2026-07-15T09:00:00.000Z'),
    );
  it('写入 GDS 样本、更新报警状态并执行规则', async () => {
    const result = await service().ingest({
      sampleId: 'sample-1',
      pointId: 'gds-101',
      source: 'GDS',
      occurredAt: '2026-07-15T08:59:00.000Z',
      metrics: { gasConcentration: 42 },
      quality: 'good',
    });
    expect(result.point).toMatchObject({
      status: 'level2',
      currentMetrics: { gasConcentration: 42 },
      version: 2,
    });
    expect(warnings.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'GDS', subjectId: 'gds-101', areaId: 'area-02' }),
    );
  });
  it('按 sampleId 幂等且不重复执行规则', async () => {
    const instance = service();
    const input = {
      sampleId: 'sample-idempotent',
      pointId: 'voc-001',
      source: 'VOC' as const,
      occurredAt: '2026-07-15T08:59:00.000Z',
      metrics: { concentration: 61 },
      quality: 'good' as const,
    };
    expect((await instance.ingest(input)).created).toBe(true);
    expect((await instance.ingest(input)).created).toBe(false);
    expect(warnings.evaluate).toHaveBeenCalledTimes(1);
  });
  it('坏质量样本标记故障且不执行规则', async () => {
    const result = await service().ingest({
      sampleId: 'sample-bad',
      pointId: 'mes-pt-101',
      source: 'MES',
      occurredAt: '2026-07-15T08:59:00.000Z',
      metrics: { value: 0.8 },
      quality: 'bad',
    });
    expect(result.point).toMatchObject({ status: 'offline', onlineStatus: 'fault' });
    expect(warnings.evaluate).not.toHaveBeenCalled();
  });
  it('拒绝数据源错配和缺失主指标', async () => {
    const instance = service();
    await expect(
      instance.ingest({
        sampleId: 'wrong-source',
        pointId: 'gds-101',
        source: 'VOC',
        occurredAt: '2026-07-15T08:59:00.000Z',
        metrics: { gasConcentration: 1 },
        quality: 'good',
      }),
    ).rejects.toMatchObject({ response: { code: 'TELEMETRY_SOURCE_MISMATCH' } });
    await expect(
      instance.ingest({
        sampleId: 'missing-metric',
        pointId: 'gds-101',
        source: 'GDS',
        occurredAt: '2026-07-15T08:59:00.000Z',
        metrics: { value: 1 },
        quality: 'good',
      }),
    ).rejects.toMatchObject({ response: { code: 'TELEMETRY_PRIMARY_METRIC_REQUIRED' } });
  });
});
