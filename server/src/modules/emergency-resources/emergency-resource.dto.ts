import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';
export class ResourceVersionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  expectedVersion?: number;
}
export class CreateResourceDto {
  @ApiProperty() @IsString() @MinLength(3) code!: string;
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiProperty() @IsIn(['消防', '气防', '医疗', '物资']) type!: '消防' | '气防' | '医疗' | '物资';
  @ApiProperty() @Type(() => Number) @IsInt() @IsPositive() totalQuantity!: number;
  @ApiProperty() @IsString() unit!: string;
  @ApiProperty() @IsString() location!: string;
  @ApiProperty() @IsString() eta!: string;
  @ApiProperty() @IsString() owner!: string;
  @ApiProperty() @IsString() contact!: string;
  @ApiProperty() @IsString() nextInspection!: string;
  @ApiProperty() @IsString() batchNo!: string;
  @ApiProperty() @IsString() receivedAt!: string;
  @ApiProperty() @IsString() expiryDate!: string;
}
export class AddResourceBatchDto extends ResourceVersionDto {
  @ApiProperty() @IsString() @MinLength(1) batchNo!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @IsPositive() quantity!: number;
  @ApiProperty() @IsString() receivedAt!: string;
  @ApiProperty() @IsString() expiryDate!: string;
}
export class DispatchResourceDto extends ResourceVersionDto {
  @ApiProperty() @IsString() @MinLength(1) eventName!: string;
  @ApiProperty() @IsString() @MinLength(1) destination!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @IsPositive() quantity!: number;
}
export class InspectResourceDto extends ResourceVersionDto {
  @ApiProperty() @IsIn(['检查合格', '即将到期', '需要维护']) result!:
    '检查合格' | '即将到期' | '需要维护';
  @ApiProperty() @IsString() nextInspection!: string;
  @ApiProperty() @IsString() @MinLength(1) note!: string;
}
