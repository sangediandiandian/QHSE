import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { hazardLevels, hazardStatuses, type HazardLevel, type HazardStatus } from '../hazard.types';

function toBoolean({ value }: { value: unknown }) {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}

export class HazardQueryDto {
  @ApiPropertyOptional({ enum: hazardStatuses })
  @IsOptional()
  @IsIn(hazardStatuses)
  status?: HazardStatus;

  @ApiPropertyOptional({ enum: hazardLevels })
  @IsOptional()
  @IsIn(hazardLevels)
  level?: HazardLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  areaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  supervised?: boolean;
}
