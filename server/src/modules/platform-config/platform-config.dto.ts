import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { IntegrationType } from './platform-config.types';

const codePattern = /^[a-z][a-z0-9_]{2,49}$/;

export class DictionaryItemDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) value!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) label!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) @Max(9999) sort!: number;
  @ApiProperty() @IsBoolean() enabled!: boolean;
  @ApiPropertyOptional() @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
}

export class CreateDictionaryDto {
  @ApiProperty() @Matches(codePattern) code!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(240) description?: string;
  @ApiProperty({ type: [DictionaryItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => DictionaryItemDto)
  items!: DictionaryItemDto[];
  @ApiProperty({ enum: ['enabled', 'disabled'] })
  @IsIn(['enabled', 'disabled'])
  status!: 'enabled' | 'disabled';
}

export class UpdateDictionaryDto extends CreateDictionaryDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) expectedVersion!: number;
}

export class CreateIntegrationDto {
  @ApiProperty() @Matches(codePattern) code!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @ApiProperty({ enum: ['telemetry', 'communication', 'identity', 'storage'] })
  @IsIn(['telemetry', 'communication', 'identity', 'storage'])
  type!: IntegrationType;
  @ApiProperty({ enum: ['HTTP', 'HTTPS', 'MQTT', 'MQTTS'] })
  @IsIn(['HTTP', 'HTTPS', 'MQTT', 'MQTTS'])
  protocol!: 'HTTP' | 'HTTPS' | 'MQTT' | 'MQTTS';
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(500) endpoint!: string;
  @ApiProperty() @IsBoolean() enabled!: boolean;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(500) @Max(60_000) timeoutMs!: number;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) owner!: string;
}

export class UpdateIntegrationDto extends CreateIntegrationDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) expectedVersion!: number;
}
