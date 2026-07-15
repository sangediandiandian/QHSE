import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UploadAttachmentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  areaId!: string;
}
