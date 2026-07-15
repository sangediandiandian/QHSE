import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';
import { WarningRuleRevisionDto } from './revision.dto';

export class RollbackWarningRuleDto extends WarningRuleRevisionDto {
  @ApiProperty() @Type(() => Number) @IsInt() @IsPositive() version!: number;
}
