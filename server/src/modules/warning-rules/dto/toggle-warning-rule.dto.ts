import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { WarningRuleRevisionDto } from './revision.dto';

export class ToggleWarningRuleDto extends WarningRuleRevisionDto {
  @ApiProperty() @IsBoolean() enabled!: boolean;
}
