import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { emergencyEventStatuses, type EmergencyEventStatus } from './emergency-event.types';

export class EmergencyEventQueryDto {
  @ApiPropertyOptional({ enum: emergencyEventStatuses })
  @IsOptional()
  @IsIn(emergencyEventStatuses)
  status?: EmergencyEventStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() areaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() keyword?: string;
}
