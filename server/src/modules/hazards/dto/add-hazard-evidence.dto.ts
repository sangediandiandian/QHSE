import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { hazardEvidenceCategories, type HazardEvidenceCategory } from '../hazard.types';
import { VersionDto } from './version.dto';

export class AddHazardEvidenceDto extends VersionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ enum: hazardEvidenceCategories })
  @IsIn(hazardEvidenceCategories)
  category!: HazardEvidenceCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
