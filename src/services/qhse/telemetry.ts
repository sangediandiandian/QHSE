import type {
  GdsPoint,
  MesTag,
  TelemetryIngestInput,
  TelemetryPoint,
  TelemetryRealtimeStatus,
  TelemetrySource,
  TelemetryStreamEvent,
  VocPoint,
} from '@/types/qhse';
import { request } from '@umijs/max';
import { io } from 'socket.io-client';
interface ApiResponse<T> {
  success: boolean;
  data: T;
}
const value = (point: TelemetryPoint) => Number(point.currentMetrics[point.metricKey]);
const trend = (current: number) =>
  [0.92, 0.95, 0.94, 0.97, 0.99, 1].map((factor) => Math.round(current * factor * 100) / 100);
export const getTelemetryPoints = async (source: TelemetrySource) =>
  (await request<ApiResponse<TelemetryPoint[]>>('/api/v1/telemetry/points', { params: { source } }))
    .data;
export const ingestTelemetrySample = async (input: TelemetryIngestInput) =>
  (
    await request<ApiResponse<{ point: TelemetryPoint; created: boolean }>>(
      '/api/v1/telemetry/samples',
      { method: 'POST', data: input },
    )
  ).data;

interface TelemetryStreamOptions {
  onSample: (event: TelemetryStreamEvent) => void;
  onStatus: (status: TelemetryRealtimeStatus) => void;
}

const sequenceStorageKey = 'qhse_telemetry_sequence';
const streamStorageKey = 'qhse_telemetry_stream_id';
export const normalizeTelemetryCursor = (
  clientSequence: number,
  serverSequence: number,
  clientStreamId?: string,
  serverStreamId?: string,
) =>
  (clientStreamId && serverStreamId && clientStreamId !== serverStreamId) ||
  serverSequence < clientSequence
    ? 0
    : clientSequence;

export function connectTelemetryStream({ onSample, onStatus }: TelemetryStreamOptions) {
  if (typeof window === 'undefined') return () => undefined;
  const token = localStorage.getItem('qhse_access_token');
  if (!token) {
    onStatus('unauthorized');
    return () => undefined;
  }
  let latestSequence = Number(sessionStorage.getItem(sequenceStorageKey) || 0);
  let streamId = sessionStorage.getItem(streamStorageKey) || undefined;
  onStatus('connecting');
  const socket = io('/telemetry', {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  socket.on('connect', () => {
    onStatus('connecting');
  });
  socket.on('telemetry:ready', (state: { streamId?: string; latestSequence?: number }) => {
    const serverSequence = Number(state?.latestSequence || 0);
    latestSequence = normalizeTelemetryCursor(
      latestSequence,
      serverSequence,
      streamId,
      state.streamId,
    );
    streamId = state.streamId;
    sessionStorage.setItem(sequenceStorageKey, String(latestSequence));
    if (streamId) sessionStorage.setItem(streamStorageKey, streamId);
    onStatus('connected');
    socket.emit('telemetry:subscribe', { afterSequence: latestSequence });
  });
  socket.on('disconnect', () => onStatus('disconnected'));
  socket.on('connect_error', () => onStatus('disconnected'));
  socket.on('telemetry:error', (error: { code?: string }) => {
    onStatus(
      error?.code === 'SESSION_INVALID' || error?.code === 'PERMISSION_DENIED'
        ? 'unauthorized'
        : 'disconnected',
    );
  });
  socket.on('telemetry:sample', (event: TelemetryStreamEvent) => {
    if (!event) return;
    if (streamId && event.streamId !== streamId) latestSequence = 0;
    if (event.sequence <= latestSequence) return;
    streamId = event.streamId;
    latestSequence = event.sequence;
    sessionStorage.setItem(sequenceStorageKey, String(latestSequence));
    sessionStorage.setItem(streamStorageKey, streamId);
    onSample(event);
  });
  return () => {
    socket.removeAllListeners();
    socket.disconnect();
    onStatus('disabled');
  };
}

export const toGdsPoint = (point: TelemetryPoint): GdsPoint => ({
  id: point.id,
  code: point.code,
  name: point.name,
  areaId: point.areaId,
  areaName: point.areaName,
  equipmentName: point.equipmentName,
  gasType: point.configuration.gasType as GdsPoint['gasType'],
  currentValue: value(point),
  unit: point.unit as GdsPoint['unit'],
  alarmLevel1: Number(point.configuration.alarmLevel1),
  alarmLevel2: Number(point.configuration.alarmLevel2),
  onlineStatus: point.onlineStatus,
  alarmStatus: point.status as GdsPoint['alarmStatus'],
  trend: trend(value(point)),
});
export const toVocPoint = (point: TelemetryPoint): VocPoint => ({
  id: point.id,
  code: point.code,
  name: point.name,
  pointType: point.configuration.pointType as VocPoint['pointType'],
  areaId: point.areaId,
  areaName: point.areaName,
  pollutantType: point.configuration.pollutantType as VocPoint['pollutantType'],
  currentValue: value(point),
  limitValue: Number(point.configuration.limitValue),
  flowValue: Number(point.currentMetrics.flow ?? 0),
  facilityId: point.equipmentName,
  status: point.status as VocPoint['status'],
  trend: trend(value(point)),
});
export const toMesTag = (point: TelemetryPoint): MesTag => ({
  id: point.id,
  code: point.code,
  name: point.name,
  unitId: point.areaId,
  unitName: point.areaName,
  equipmentName: point.equipmentName,
  processStep: point.configuration.processStep as MesTag['processStep'],
  parameterType: point.configuration.parameterType as MesTag['parameterType'],
  currentValue: value(point),
  unit: point.unit,
  upperLimit: Number(point.configuration.upperLimit),
  lowerLimit: Number(point.configuration.lowerLimit),
  status: point.status as MesTag['status'],
  trend: trend(value(point)),
});
