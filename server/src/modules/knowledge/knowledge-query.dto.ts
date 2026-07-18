import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { knowledgeSourceTypes, type KnowledgeSourceType } from './knowledge.types';

export class KnowledgeQueryDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  keyword!: string;

  @ApiPropertyOptional({ enum: knowledgeSourceTypes })
  @IsOptional()
  @IsIn(knowledgeSourceTypes)
  type?: KnowledgeSourceType;

  @ApiPropertyOptional({ minimum: 1, maximum: 20, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 10;
}
