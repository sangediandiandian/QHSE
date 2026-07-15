import { IsIn, IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';
import { type WarningEvidenceCategory, warningEvidenceCategories } from './warning-execution.types';

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

export class VerifyWarningEvidenceDto extends WarningSignalVersionDto {
  @IsIn(warningEvidenceCategories)
  category!: WarningEvidenceCategory;
}
