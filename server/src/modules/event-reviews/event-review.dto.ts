import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsIn, IsInt, IsString, Min, MinLength } from 'class-validator';

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

export class AddEventReviewEvidenceDto extends EventReviewVersionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  objectId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ enum: ['调查报告', '现场照片', '检测报告', '培训记录'] })
  @IsIn(['调查报告', '现场照片', '检测报告', '培训记录'])
  category!: '调查报告' | '现场照片' | '检测报告' | '培训记录';

  @ApiProperty()
  @IsString()
  @MinLength(2)
  note!: string;
}

export class SaveEventReviewActionDto extends EventReviewVersionDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  ownerDepartment!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  owner!: string;

  @ApiProperty()
  @IsISO8601({ strict: true })
  deadline!: string;

  @ApiProperty({ enum: ['一般', '重要', '紧急'] })
  @IsIn(['一般', '重要', '紧急'])
  priority!: '一般' | '重要' | '紧急';
}
