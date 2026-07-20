import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CheckHazardDuplicatesDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  riskUnitId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  category!: string;
}
