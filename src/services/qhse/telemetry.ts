import type {
  GdsPoint,
  MesTag,
  TelemetryIngestInput,
  TelemetryPoint,
  TelemetrySource,
  VocPoint,
} from '@/types/qhse';
import { request } from '@umijs/max';
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
