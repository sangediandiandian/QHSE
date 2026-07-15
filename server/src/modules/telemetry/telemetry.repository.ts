import type {
  IngestResult,
  TelemetryPoint,
  TelemetrySample,
  TelemetrySource,
} from './telemetry.types';
export const TELEMETRY_REPOSITORY = Symbol('TELEMETRY_REPOSITORY');
export interface TelemetryPointQuery {
  source?: TelemetrySource;
  areaId?: string;
  status?: string;
  areaIds?: string[];
}
export interface TelemetryRepository {
  listPoints(query: TelemetryPointQuery): Promise<TelemetryPoint[]>;
  findPoint(id: string): Promise<TelemetryPoint | undefined>;
  listSamples(pointId: string, limit: number): Promise<TelemetrySample[]>;
  ingest(
    point: TelemetryPoint,
    sample: TelemetrySample,
    updatePoint?: boolean,
  ): Promise<IngestResult>;
}
