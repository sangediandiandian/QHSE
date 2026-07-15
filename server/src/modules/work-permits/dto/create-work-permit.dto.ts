import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import {
  workPermitRiskLevels,
  workPermitTypes,
  type WorkPermitRiskLevel,
  type WorkPermitType,
} from '../work-permit.types';

export class CreateWorkPermitDto {
  @ApiProperty({ enum: workPermitTypes }) @IsIn(workPermitTypes) type!: WorkPermitType;
  @ApiProperty() @IsString() @MinLength(1) areaId!: string;
  @ApiProperty() @IsString() @MinLength(1) workContent!: string;
  @ApiProperty() @IsString() @MinLength(1) guardian!: string;
  @ApiProperty({ example: '2026-07-15 09:00' })
  @Matches(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  startAt!: string;
  @ApiProperty({ example: '2026-07-15 17:00' })
  @Matches(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  endAt!: string;
  @ApiProperty({ enum: workPermitRiskLevels })
  @IsIn(workPermitRiskLevels)
  riskLevel!: WorkPermitRiskLevel;
  @ApiProperty() @IsString() @MinLength(1) gasTest!: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) linkedGdsCodes!: string[];
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  safetyMeasures!: string[];
  @ApiProperty() @IsNumber() @Min(0) @Max(100) workX!: number;
  @ApiProperty() @IsNumber() @Min(0) @Max(100) workY!: number;
}
