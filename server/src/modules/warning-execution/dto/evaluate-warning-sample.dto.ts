import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class EvaluateWarningSampleDto {
  @ApiProperty({ enum: ['GDS', 'VOC', 'MES', '联合预警'] })
  @IsIn(['GDS', 'VOC', 'MES', '联合预警'])
  source!: 'GDS' | 'VOC' | 'MES' | '联合预警';

  @ApiProperty()
  @IsString()
  @MinLength(1)
  subjectId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  areaId?: string;

  @ApiProperty()
  @IsISO8601()
  occurredAt!: string;

  @ApiProperty({ type: Object })
  @IsObject()
  metrics!: Record<string, string | number | boolean>;
}
