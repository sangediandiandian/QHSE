import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsIn, IsString, Matches, MinLength } from 'class-validator';
import { hazardLevels, hazardSources, type HazardLevel, type HazardSource } from '../hazard.types';

export class CreateHazardDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  riskUnitId!: string;

  @ApiProperty({ enum: hazardLevels })
  @IsIn(hazardLevels)
  level!: HazardLevel;

  @ApiProperty({ enum: hazardSources })
  @IsIn(hazardSources)
  source!: HazardSource;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  category!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  ownerDepartment!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  owner!: string;

  @ApiProperty({ example: '2026-07-15' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  discoveredAt!: string;

  @ApiProperty({ example: '2026-07-22' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  deadline!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  measures!: string[];
}
