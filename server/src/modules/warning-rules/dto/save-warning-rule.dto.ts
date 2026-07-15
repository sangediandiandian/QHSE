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
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { riskLevels, type RiskLevel } from '../../risks/risk.types';
import {
  warningRuleScenarios,
  warningRuleSources,
  type WarningRuleScenario,
  type WarningRuleSource,
} from '../warning-rule.types';

export class WarningRuleExpressionDto {
  @ApiProperty() @IsString() @MinLength(1) metric!: string;
  @ApiProperty({ enum: ['>', '>=', '<', '<=', '='] }) @IsIn(['>', '>=', '<', '<=', '=']) operator!:
    '>' | '>=' | '<' | '<=' | '=';
  @ApiProperty() @IsString() @MinLength(1) threshold!: string;
  @ApiProperty({ enum: ['AND', 'OR'] }) @IsIn(['AND', 'OR']) connector!: 'AND' | 'OR';
}

export class SaveWarningRuleDto {
  @ApiProperty() @Matches(/^[A-Za-z][A-Za-z0-9_]{2,31}$/) code!: string;
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiProperty({ enum: warningRuleSources }) @IsIn(warningRuleSources) source!: WarningRuleSource;
  @ApiProperty({ enum: warningRuleScenarios })
  @IsIn(warningRuleScenarios)
  scenario!: WarningRuleScenario;
  @ApiProperty({ enum: riskLevels }) @IsIn(riskLevels) level!: RiskLevel;
  @ApiProperty() @IsString() @MinLength(1) scope!: string;
  @ApiProperty() @IsString() @MinLength(1) condition!: string;
  @ApiProperty() @IsString() @MinLength(1) duration!: string;
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  notifyTargets!: string[];
  @ApiProperty() @IsString() @MinLength(1) description!: string;
  @ApiProperty({ type: [WarningRuleExpressionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WarningRuleExpressionDto)
  expression!: WarningRuleExpressionDto[];
  @ApiProperty({ enum: [25, 50, 100] })
  @Type(() => Number)
  @IsIn([25, 50, 100])
  rolloutPercentage!: 25 | 50 | 100;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  expectedRevision?: number;
}
