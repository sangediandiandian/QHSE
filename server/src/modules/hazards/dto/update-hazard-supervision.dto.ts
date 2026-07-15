import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { VersionDto } from './version.dto';

export class UpdateHazardSupervisionDto extends VersionDto {
  @ApiProperty()
  @IsBoolean()
  supervised!: boolean;
}
