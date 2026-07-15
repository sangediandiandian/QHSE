import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { workPermitConfirmationRoles, type WorkPermitConfirmationRole } from '../work-permit.types';
import { WorkPermitVersionDto } from './version.dto';

export class ConfirmWorkPermitSiteDto extends WorkPermitVersionDto {
  @ApiProperty({ enum: workPermitConfirmationRoles })
  @IsIn(workPermitConfirmationRoles)
  role!: WorkPermitConfirmationRole;
}
