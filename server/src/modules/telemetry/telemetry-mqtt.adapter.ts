import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { connect, type MqttClient } from 'mqtt';
import type { IngestTelemetrySampleDto } from './telemetry.dto';
import { TelemetryService } from './telemetry.service';
import type { TelemetrySource } from './telemetry.types';

export function parseMqttTelemetrySample(topic: string, payload: Buffer): IngestTelemetrySampleDto {
  const parsed = JSON.parse(payload.toString('utf8')) as Record<string, unknown>;
  const topicParts = topic.split('/');
  const topicSource = topicParts.at(-2)?.toUpperCase();
  const topicPointId = topicParts.at(-1);
  const source = String(parsed.source ?? topicSource ?? '').toUpperCase();
  const pointId = String(parsed.pointId ?? topicPointId ?? '');
  const sampleId = String(parsed.sampleId ?? '');
  const occurredAt = String(parsed.occurredAt ?? '');
  const quality = String(parsed.quality ?? 'good');
  if (!['GDS', 'VOC', 'MES'].includes(source)) throw new Error('MQTT_SOURCE_INVALID');
  if (!pointId || !sampleId) throw new Error('MQTT_ID_REQUIRED');
  if (!occurredAt || Number.isNaN(Date.parse(occurredAt)))
    throw new Error('MQTT_OCCURRED_AT_INVALID');
  if (!parsed.metrics || typeof parsed.metrics !== 'object' || Array.isArray(parsed.metrics))
    throw new Error('MQTT_METRICS_INVALID');
  if (!['good', 'uncertain', 'bad'].includes(quality)) throw new Error('MQTT_QUALITY_INVALID');
  return {
    sampleId,
    pointId,
    source: source as TelemetrySource,
    occurredAt: new Date(occurredAt).toISOString(),
    metrics: parsed.metrics as Record<string, string | number | boolean>,
    quality: quality as IngestTelemetrySampleDto['quality'],
  };
}

@Injectable()
export class TelemetryMqttAdapter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemetryMqttAdapter.name);
  private readonly topic = process.env.QHSE_MQTT_TOPIC || 'qhse/telemetry/+/+';
  private client?: MqttClient;
  private state: 'disabled' | 'connecting' | 'connected' | 'disconnected' | 'error' = 'disabled';
  private receivedCount = 0;
  private rejectedCount = 0;
  private lastMessageAt?: string;
  private lastError?: string;

  constructor(private readonly telemetry: TelemetryService) {}

  onModuleInit() {
    const url = process.env.QHSE_MQTT_URL;
    if (!url) return;
    const configuredClientId = process.env.QHSE_MQTT_CLIENT_ID;
    this.state = 'connecting';
    this.client = connect(url, {
      clientId: configuredClientId || `qhse-api-${process.pid}`,
      username: process.env.QHSE_MQTT_USERNAME,
      password: process.env.QHSE_MQTT_PASSWORD,
      reconnectPeriod: 3000,
      clean: !configuredClientId,
    });
    this.client.on('connect', () => {
      this.state = 'connected';
      this.lastError = undefined;
      this.client?.subscribe(this.topic, { qos: 1 }, (error) => {
        if (error) this.connectionFailed(error);
        else this.logger.log(`MQTT telemetry subscribed: ${this.topic}`);
      });
    });
    this.client.on('reconnect', () => {
      this.state = 'connecting';
    });
    this.client.on('close', () => {
      if (this.state !== 'error') this.state = 'disconnected';
    });
    this.client.on('error', (error) => this.connectionFailed(error));
    this.client.on('message', (topic, payload) => {
      void this.handleMessage(topic, payload);
    });
  }

  onModuleDestroy() {
    this.client?.end(true);
  }

  status() {
    return {
      enabled: Boolean(process.env.QHSE_MQTT_URL),
      state: this.state,
      topic: this.topic,
      receivedCount: this.receivedCount,
      rejectedCount: this.rejectedCount,
      lastMessageAt: this.lastMessageAt,
      lastError: this.lastError,
    };
  }

  async handleMessage(topic: string, payload: Buffer) {
    try {
      const input = parseMqttTelemetrySample(topic, payload);
      await this.telemetry.ingest(input);
      this.receivedCount += 1;
      this.lastMessageAt = new Date().toISOString();
      this.lastError = undefined;
    } catch (error) {
      this.rejectedCount += 1;
      this.lastError = error instanceof Error ? error.message : String(error);
      this.logger.warn(`MQTT telemetry rejected: ${this.lastError}`);
    }
  }

  private connectionFailed(error: unknown) {
    this.state = 'error';
    this.lastError = error instanceof Error ? error.message : String(error);
    this.logger.warn(`MQTT connection error: ${this.lastError}`);
  }
}
