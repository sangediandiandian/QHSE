import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @Matches(/^[a-z][a-z0-9._-]{2,49}$/)
  username!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  initialPassword!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  organizationId!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsString({ each: true })
  roleCodes!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  areaIds!: string[];
}

export class UpdateUserAuthorizationDto {
  @ApiProperty({ enum: ['enabled', 'disabled'] })
  @IsIn(['enabled', 'disabled'])
  status!: 'enabled' | 'disabled';

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  organizationId!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsString({ each: true })
  roleCodes!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  areaIds!: string[];

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
