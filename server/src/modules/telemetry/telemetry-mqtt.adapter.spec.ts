import { parseMqttTelemetrySample, TelemetryMqttAdapter } from './telemetry-mqtt.adapter';

describe('parseMqttTelemetrySample', () => {
  it('从标准主题和载荷构造统一样本', () => {
    expect(
      parseMqttTelemetrySample(
        'qhse/telemetry/GDS/gds-101',
        Buffer.from(
          JSON.stringify({
            sampleId: 'mqtt-1',
            occurredAt: '2026-07-15T09:00:00+08:00',
            metrics: { gasConcentration: 26 },
            quality: 'good',
          }),
        ),
      ),
    ).toEqual({
      sampleId: 'mqtt-1',
      pointId: 'gds-101',
      source: 'GDS',
      occurredAt: '2026-07-15T01:00:00.000Z',
      metrics: { gasConcentration: 26 },
      quality: 'good',
    });
  });

  it('拒绝缺少幂等标识或非法质量码的载荷', () => {
    expect(() =>
      parseMqttTelemetrySample(
        'qhse/telemetry/VOC/voc-001',
        Buffer.from(
          JSON.stringify({ occurredAt: '2026-07-15T01:00:00Z', metrics: { concentration: 10 } }),
        ),
      ),
    ).toThrow('MQTT_ID_REQUIRED');
    expect(() =>
      parseMqttTelemetrySample(
        'qhse/telemetry/MES/mes-pt-101',
        Buffer.from(
          JSON.stringify({
            sampleId: 'mqtt-2',
            occurredAt: '2026-07-15T01:00:00Z',
            metrics: { value: 1 },
            quality: 'unknown',
          }),
        ),
      ),
    ).toThrow('MQTT_QUALITY_INVALID');
  });

  it('单条坏消息只计入拒绝数，不改变连接状态', async () => {
    const adapter = new TelemetryMqttAdapter({ ingest: jest.fn() } as never);
    await adapter.handleMessage('qhse/telemetry/GDS/gds-101', Buffer.from('{}'));
    expect(adapter.status()).toMatchObject({
      state: 'disabled',
      receivedCount: 0,
      rejectedCount: 1,
    });
  });
});
