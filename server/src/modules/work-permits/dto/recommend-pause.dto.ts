import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { WorkPermitVersionDto } from './version.dto';

export class RecommendWorkPermitPauseDto extends WorkPermitVersionDto {
  @ApiProperty() @IsString() @MinLength(1) reason!: string;
}
