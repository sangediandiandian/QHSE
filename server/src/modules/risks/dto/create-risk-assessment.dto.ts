import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

export class CreateRiskAssessmentDto {
  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  likelihood!: number;

  @ApiProperty({ example: 6 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  exposure!: number;

  @ApiProperty({ example: 7 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  consequence!: number;

  @ApiProperty({ example: '现场复核' })
  @IsString()
  @MinLength(1)
  basis!: string;

  @ApiPropertyOptional({ description: '客户端读取到的数据版本，用于并发控制' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  expectedVersion?: number;
}
