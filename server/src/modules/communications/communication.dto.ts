import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsPositive } from 'class-validator';
export class CommunicationVersionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  expectedVersion?: number;
}
export class CommunicationReceiptDto extends CommunicationVersionDto {
  @ApiProperty({ enum: ['已送达', '失败'] }) @IsIn(['已送达', '失败']) deliveryStatus!:
    '已送达' | '失败';
}
