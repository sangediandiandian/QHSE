import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class EventReviewVersionDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class AdvanceReviewActionDto extends EventReviewVersionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  actionId!: string;
}

export class UpdateEventReviewAnalysisDto extends EventReviewVersionDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  summary!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  directCause!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  rootCause!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  lesson!: string;
}
