import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { riskLevels, type RiskLevel } from '../risk.types';

export class RiskQueryDto {
  @ApiPropertyOptional({ description: '区域 ID' })
  @IsOptional()
  @IsString()
  areaId?: string;

  @ApiPropertyOptional({ enum: riskLevels, description: '实时风险等级' })
  @IsOptional()
  @IsEnum(riskLevels)
  level?: RiskLevel;

  @ApiPropertyOptional({ description: '编号、名称、责任人或区域关键字' })
  @IsOptional()
  @IsString()
  keyword?: string;
}
