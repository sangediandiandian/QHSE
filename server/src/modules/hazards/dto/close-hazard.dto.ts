import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { VersionDto } from './version.dto';

export class CloseHazardDto extends VersionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  opinion!: string;
}
