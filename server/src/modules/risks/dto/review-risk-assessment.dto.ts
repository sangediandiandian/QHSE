import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class ReviewRiskAssessmentDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';

  @ApiPropertyOptional({ description: '审批意见；驳回时必填' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  opinion?: string;

  @ApiPropertyOptional({ description: '客户端读取到的风险单元版本，用于并发控制' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  expectedVersion?: number;
}
