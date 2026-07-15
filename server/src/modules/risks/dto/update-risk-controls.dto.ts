import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RiskControlDto {
  @ApiProperty({ example: '每班开展设备巡检' })
  @IsString()
  @MinLength(1)
  content!: string;

  @ApiProperty({ example: '李建国' })
  @IsString()
  @MinLength(1)
  owner!: string;

  @ApiProperty({ enum: ['有效', '待验证'] })
  @IsIn(['有效', '待验证'])
  status!: '有效' | '待验证';
}

export class UpdateRiskControlsDto {
  @ApiProperty({ type: [RiskControlDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RiskControlDto)
  controls!: RiskControlDto[];

  @ApiPropertyOptional({ description: '客户端读取到的数据版本，用于并发控制' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  expectedVersion?: number;
}
