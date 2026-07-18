import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class OidcCompletionDto {
  @ApiProperty()
  @Matches(/^[a-f0-9]{64}$/)
  completionCode!: string;
}
