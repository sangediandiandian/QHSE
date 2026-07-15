export type TelemetrySource = 'GDS' | 'VOC' | 'MES';
export type MetricValue = string | number | boolean;
export interface TelemetryPoint {
  id: string;
  code: string;
  source: TelemetrySource;
  name: string;
  areaId: string;
  areaName: string;
  equipmentName: string;
  metricKey: string;
  unit: string;
  configuration: Record<string, MetricValue>;
  currentMetrics: Record<string, MetricValue>;
  status: string;
  onlineStatus: 'online' | 'offline' | 'fault';
  lastSampleAt?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface TelemetrySample {
  id: string;
  pointId: string;
  source: TelemetrySource;
  occurredAt: string;
  metrics: Record<string, MetricValue>;
  quality: 'good' | 'uncertain' | 'bad';
  createdAt: string;
}
export interface IngestResult {
  point: TelemetryPoint;
  sample: TelemetrySample;
  created: boolean;
}

export interface TelemetryIngestOutcome extends IngestResult {
  outOfOrder: boolean;
  clockDriftMs: number;
  evaluation?: {
    evaluatedRuleCount: number;
    triggeredSignals: unknown[];
    suppressedRuleIds: string[];
    linkedPermitIds: string[];
  };
}

export interface TelemetryStreamEvent {
  streamId: string;
  sequence: number;
  emittedAt: string;
  point: TelemetryPoint;
  sample: TelemetrySample;
  outOfOrder: boolean;
  clockDriftMs: number;
}
