import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import type { EmergencyPlanConfig } from './emergency-plan.types';
export class PlanRevisionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  expectedRevision?: number;
}
export class SaveEmergencyPlanDto extends PlanRevisionDto implements EmergencyPlanConfig {
  @ApiProperty() @IsString() @MinLength(3) code!: string;
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiProperty()
  @IsIn(['综合应急预案', '专项应急预案', '现场处置方案', '岗位应急处置卡'])
  category!: EmergencyPlanConfig['category'];
  @ApiProperty() @IsString() @MinLength(1) eventType!: string;
  @ApiProperty() @IsString() @MinLength(1) applicableArea!: string;
  @ApiProperty() @IsString() @MinLength(1) medium!: string;
  @ApiProperty()
  @IsIn(['IV级', 'III级', 'II级', 'I级'])
  responseLevel!: EmergencyPlanConfig['responseLevel'];
  @ApiProperty() @IsString() @MinLength(1) triggerRule!: string;
  @ApiProperty()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  notificationTargets!: string[];
  @ApiProperty() @IsArray() @ArrayMinSize(1) @IsString({ each: true }) steps!: string[];
  @ApiProperty() @IsArray() @ArrayMinSize(1) @IsString({ each: true }) resources!: string[];
  @ApiProperty() @IsString() effectiveDate!: string;
  @ApiProperty() @IsString() expiryDate!: string;
  @ApiProperty() @IsString() @MinLength(1) ownerDepartment!: string;
}
export class RollbackPlanDto extends PlanRevisionDto {
  @ApiProperty() @IsString() version!: string;
}
export class ApprovePlanDto extends PlanRevisionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() opinion?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  workflowVersion?: number;
}
export class AddDrillDto extends PlanRevisionDto {
  @ApiProperty() @IsString() @MinLength(1) title!: string;
  @ApiProperty() @IsIn(['桌面推演', '专项演练', '综合演练']) type!:
    '桌面推演' | '专项演练' | '综合演练';
  @ApiProperty() @IsString() plannedAt!: string;
  @ApiProperty() @IsString() location!: string;
  @ApiProperty() @IsString() leader!: string;
  @ApiProperty() @IsArray() @ArrayMinSize(1) @IsString({ each: true }) participants!: string[];
}
export class RecordDrillDto extends PlanRevisionDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) @Max(100) score!: number;
  @ApiProperty() @IsString() @MinLength(1) summary!: string;
  @ApiProperty() @IsArray() @IsString({ each: true }) issues!: string[];
}
