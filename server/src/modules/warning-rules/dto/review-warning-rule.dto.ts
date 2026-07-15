import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { WarningRuleRevisionDto } from './revision.dto';

export class ReviewWarningRuleDto extends WarningRuleRevisionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() opinion?: string;
}
