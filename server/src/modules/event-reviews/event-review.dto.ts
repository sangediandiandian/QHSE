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
