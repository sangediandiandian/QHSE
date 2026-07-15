import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class WarningSignalVersionDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class CloseWarningSignalDto extends WarningSignalVersionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
