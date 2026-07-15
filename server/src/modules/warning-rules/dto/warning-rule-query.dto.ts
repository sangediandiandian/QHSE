import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import {
  warningRuleSources,
  type WarningRulePublishStatus,
  type WarningRuleSource,
} from '../warning-rule.types';

export class WarningRuleQueryDto {
  @ApiPropertyOptional({ enum: warningRuleSources })
  @IsOptional()
  @IsIn(warningRuleSources)
  source?: WarningRuleSource;
  @ApiPropertyOptional({ enum: ['草稿', '待审批', '已发布'] })
  @IsOptional()
  @IsIn(['草稿', '待审批', '已发布'])
  publishStatus?: WarningRulePublishStatus;
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() keyword?: string;
}
