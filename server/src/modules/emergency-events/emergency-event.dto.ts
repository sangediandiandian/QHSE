import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';
import {
  emergencyEvidenceCategories,
  emergencyResponseLevels,
  emergencySources,
  type EmergencyEvidenceCategory,
  type EmergencyResponseLevel,
  type EmergencySource,
} from './emergency-event.types';

export class EventVersionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  expectedVersion?: number;
}

export class CreateEmergencyEventDto {
  @ApiProperty() @IsString() @MinLength(1) eventId!: string;
  @ApiProperty() @IsString() @MinLength(1) title!: string;
  @ApiProperty() @IsString() @MinLength(1) areaId!: string;
  @ApiProperty({ enum: emergencySources }) @IsIn(emergencySources) source!: EmergencySource;
  @ApiProperty({ enum: emergencyResponseLevels })
  @IsIn(emergencyResponseLevels)
  responseLevel!: EmergencyResponseLevel;
  @ApiProperty() @IsString() @MinLength(1) summary!: string;
}

export class TransitionEmergencyEventDto extends EventVersionDto {
  @ApiProperty({ enum: ['研判启动', '升级响应', '降级响应', '终止响应'] })
  @IsIn(['研判启动', '升级响应', '降级响应', '终止响应'])
  action!: '研判启动' | '升级响应' | '降级响应' | '终止响应';
}

export class AddEmergencyEvidenceDto extends EventVersionDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiProperty({ enum: emergencyEvidenceCategories })
  @IsIn(emergencyEvidenceCategories)
  category!: EmergencyEvidenceCategory;
  @ApiProperty() @IsString() @MinLength(1) note!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() hash?: string;
}

export class ApproveEmergencyClosureDto extends EventVersionDto {
  @ApiProperty() @IsString() @MinLength(1) opinion!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  workflowVersion?: number;
}
