import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '../audit/audit.decorator';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import type { AuthPrincipal } from '../iam/iam.types';
import {
  AddDrillDto,
  ApprovePlanDto,
  PlanRevisionDto,
  RecordDrillDto,
  RollbackPlanDto,
  SaveEmergencyPlanDto,
} from './emergency-plan.dto';
import { EmergencyPlanService } from './emergency-plan.service';
@ApiTags('应急预案与演练')
@ApiBearerAuth()
@Controller('v1/emergency-plans')
export class EmergencyPlanController {
  constructor(private service: EmergencyPlanService) {}
  @Get() @RequirePermissions('plan:read') list() {
    return this.service.list();
  }
  @Get(':id') @RequirePermissions('plan:read') get(@Param('id') id: string) {
    return this.service.get(id);
  }
  @Post()
  @RequirePermissions('plan:edit')
  @AuditAction({ action: 'plan.create', resourceType: 'emergency_plan' })
  create(@Body() input: SaveEmergencyPlanDto) {
    return this.service.save(undefined, input);
  }
  @Put(':id/draft')
  @RequirePermissions('plan:edit')
  @AuditAction({
    action: 'plan.draft.update',
    resourceType: 'emergency_plan',
    resourceIdParam: 'id',
  })
  update(@Param('id') id: string, @Body() input: SaveEmergencyPlanDto) {
    return this.service.save(id, input);
  }
  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermissions('plan:submit')
  @AuditAction({ action: 'plan.submit', resourceType: 'emergency_plan', resourceIdParam: 'id' })
  submit(
    @Param('id') id: string,
    @Body() input: PlanRevisionDto,
    @CurrentPrincipal() p: AuthPrincipal,
  ) {
    return this.service.submit(id, input, actor(p));
  }
  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions('plan:approve')
  @AuditAction({ action: 'plan.approve', resourceType: 'emergency_plan', resourceIdParam: 'id' })
  approve(
    @Param('id') id: string,
    @Body() input: ApprovePlanDto,
    @CurrentPrincipal() p: AuthPrincipal,
  ) {
    return this.service.approve(id, input, actor(p));
  }
  @Post(':id/rollback')
  @HttpCode(200)
  @RequirePermissions('plan:edit')
  @AuditAction({ action: 'plan.rollback', resourceType: 'emergency_plan', resourceIdParam: 'id' })
  rollback(@Param('id') id: string, @Body() input: RollbackPlanDto) {
    return this.service.rollback(id, input);
  }
  @Post(':id/drills')
  @RequirePermissions('plan:drill')
  @AuditAction({
    action: 'plan.drill.create',
    resourceType: 'emergency_plan',
    resourceIdParam: 'id',
  })
  addDrill(@Param('id') id: string, @Body() input: AddDrillDto) {
    return this.service.addDrill(id, input);
  }
  @Post(':id/drills/:drillId/start') @HttpCode(200) @RequirePermissions('plan:drill') start(
    @Param('id') id: string,
    @Param('drillId') drillId: string,
    @Body() input: PlanRevisionDto,
  ) {
    return this.service.startDrill(id, drillId, input);
  }
  @Post(':id/drills/:drillId/record') @HttpCode(200) @RequirePermissions('plan:drill') record(
    @Param('id') id: string,
    @Param('drillId') drillId: string,
    @Body() input: RecordDrillDto,
  ) {
    return this.service.recordDrill(id, drillId, input);
  }
}
const actor = (p: AuthPrincipal) => ({ actorId: p.userId, actorName: p.name, roleCodes: p.roles });
