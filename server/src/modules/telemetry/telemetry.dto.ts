import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import type { TelemetrySource } from './telemetry.types';
export class TelemetryPointQueryDto {
  @ApiPropertyOptional({ enum: ['GDS', 'VOC', 'MES'] })
  @IsOptional()
  @IsIn(['GDS', 'VOC', 'MES'])
  source?: TelemetrySource;
  @ApiPropertyOptional() @IsOptional() @IsString() areaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
}
export class TelemetryHistoryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
export class IngestTelemetrySampleDto {
  @ApiProperty() @IsString() @MinLength(1) sampleId!: string;
  @ApiProperty() @IsString() @MinLength(1) pointId!: string;
  @ApiProperty({ enum: ['GDS', 'VOC', 'MES'] })
  @IsIn(['GDS', 'VOC', 'MES'])
  source!: TelemetrySource;
  @ApiProperty() @IsISO8601() occurredAt!: string;
  @ApiProperty({ type: Object }) @IsObject() metrics!: Record<string, string | number | boolean>;
  @ApiProperty({ enum: ['good', 'uncertain', 'bad'] })
  @IsIn(['good', 'uncertain', 'bad'])
  quality!: 'good' | 'uncertain' | 'bad';
}
