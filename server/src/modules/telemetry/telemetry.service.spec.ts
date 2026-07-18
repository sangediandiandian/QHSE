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
      expect.objectContaining({
        source: 'GDS',
        subjectId: 'gds-101',
        areaId: 'area-02',
        metrics: expect.objectContaining({
          gasConcentration: 42,
          'GDS.currentValue': 42,
        }),
      }),
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
    expect(warnings.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        metrics: expect.objectContaining({
          concentration: 61,
          'VOC.outletValue': 61,
          limit: 60,
        }),
      }),
    );
  });
  it('将 MES 主指标和上下限转换为规则指标', async () => {
    await service().ingest({
      sampleId: 'sample-mes-rule',
      pointId: 'mes-pt-101',
      source: 'MES',
      occurredAt: '2026-07-15T08:59:00.000Z',
      metrics: { value: 1.35 },
      quality: 'good',
    });
    expect(warnings.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        metrics: expect.objectContaining({
          value: 1.35,
          'MES.pressure': 1.35,
          high: 1.2,
          low: 0.5,
        }),
      }),
    );
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
  it('保存乱序样本但不覆盖当前值或重复执行规则', async () => {
    const instance = service();
    await instance.ingest({
      sampleId: 'ordered-sample',
      pointId: 'gds-101',
      source: 'GDS',
      occurredAt: '2026-07-15T08:59:00.000Z',
      metrics: { gasConcentration: 42 },
      quality: 'good',
    });
    const result = await instance.ingest({
      sampleId: 'late-sample',
      pointId: 'gds-101',
      source: 'GDS',
      occurredAt: '2026-07-15T08:58:00.000Z',
      metrics: { gasConcentration: 5 },
      quality: 'good',
    });
    expect(result).toMatchObject({
      created: true,
      outOfOrder: true,
      point: { currentMetrics: { gasConcentration: 42 }, version: 2 },
    });
    expect(await instance.history('gds-101', 10)).toHaveLength(2);
    expect(warnings.evaluate).toHaveBeenCalledTimes(1);
  });
  it('拒绝超出允许偏差的未来样本', async () => {
    await expect(
      service().ingest({
        sampleId: 'future-sample',
        pointId: 'mes-pt-101',
        source: 'MES',
        occurredAt: '2026-07-15T09:02:00.000Z',
        metrics: { value: 0.9 },
        quality: 'good',
      }),
    ).rejects.toMatchObject({ response: { code: 'TELEMETRY_CLOCK_AHEAD' } });
  });
});
