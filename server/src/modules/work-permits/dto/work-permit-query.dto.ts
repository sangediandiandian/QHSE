import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import {
  workPermitRiskLevels,
  workPermitStatuses,
  workPermitTypes,
  type WorkPermitQuery,
  type WorkPermitRiskLevel,
  type WorkPermitStatus,
  type WorkPermitType,
} from '../work-permit.types';

export class WorkPermitQueryDto implements WorkPermitQuery {
  @ApiPropertyOptional({ enum: workPermitStatuses })
  @IsOptional()
  @IsIn(workPermitStatuses)
  status?: WorkPermitStatus;
  @ApiPropertyOptional({ enum: workPermitTypes })
  @IsOptional()
  @IsIn(workPermitTypes)
  type?: WorkPermitType;
  @ApiPropertyOptional({ enum: workPermitRiskLevels })
  @IsOptional()
  @IsIn(workPermitRiskLevels)
  riskLevel?: WorkPermitRiskLevel;
  @ApiPropertyOptional() @IsOptional() @IsString() areaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() keyword?: string;
}
