import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '../audit/audit.decorator';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import type { AuthPrincipal } from '../iam/iam.types';
import {
  AddEmergencyEvidenceDto,
  ApproveEmergencyClosureDto,
  CreateEmergencyEventDto,
  EventVersionDto,
  TransitionEmergencyEventDto,
} from './emergency-event.dto';
import { EmergencyEventQueryDto } from './emergency-event-query.dto';
import { EmergencyEventService } from './emergency-event.service';

@ApiTags('应急事件生命周期')
@ApiBearerAuth()
@Controller('v1/emergency-events')
export class EmergencyEventController {
  constructor(private readonly service: EmergencyEventService) {}

  @Get()
  @RequirePermissions('emergency:read')
  @ApiOperation({ summary: '查询应急事件台账' })
  list(@Query() query: EmergencyEventQueryDto, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.service.list(query, allowedAreas(principal));
  }

  @Get(':id')
  @RequirePermissions('emergency:read')
  @ApiOperation({ summary: '查询应急事件详情' })
  get(@Param('id') id: string, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.service.get(id, allowedAreas(principal));
  }

  @Post()
  @RequirePermissions('emergency:manage')
  @AuditAction({ action: 'emergency.event.create', resourceType: 'emergency_event' })
  @ApiOperation({ summary: '将预警转为应急事件' })
  create(@Body() input: CreateEmergencyEventDto, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.service.create(input, access(principal));
  }

  @Post(':id/actions')
  @HttpCode(200)
  @RequirePermissions('emergency:manage')
  @AuditAction({
    action: 'emergency.event.transition',
    resourceType: 'emergency_event',
    resourceIdParam: 'id',
  })
  transition(
    @Param('id') id: string,
    @Body() input: TransitionEmergencyEventDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.transition(id, input, access(principal));
  }

  @Post(':id/evidence')
  @RequirePermissions('emergency:evidence')
  @AuditAction({
    action: 'emergency.evidence.add',
    resourceType: 'emergency_event',
    resourceIdParam: 'id',
  })
  addEvidence(
    @Param('id') id: string,
    @Body() input: AddEmergencyEvidenceDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.addEvidence(id, input, access(principal));
  }

  @Post(':id/closure-request')
  @HttpCode(200)
  @RequirePermissions('emergency:manage')
  @AuditAction({
    action: 'emergency.closure.request',
    resourceType: 'emergency_event',
    resourceIdParam: 'id',
  })
  requestClose(
    @Param('id') id: string,
    @Body() input: EventVersionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.requestClose(id, input, access(principal));
  }

  @Post(':id/closure-reminder')
  @HttpCode(200)
  @RequirePermissions('emergency:manage')
  @AuditAction({
    action: 'emergency.closure.remind',
    resourceType: 'emergency_event',
    resourceIdParam: 'id',
  })
  remind(
    @Param('id') id: string,
    @Body() input: EventVersionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.remind(id, input, access(principal));
  }

  @Post(':id/closure-approval')
  @HttpCode(200)
  @RequirePermissions('emergency:approve')
  @AuditAction({
    action: 'emergency.closure.approve',
    resourceType: 'emergency_event',
    resourceIdParam: 'id',
  })
  approveClose(
    @Param('id') id: string,
    @Body() input: ApproveEmergencyClosureDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.approveClose(id, input, access(principal));
  }
}

function allowedAreas(principal: AuthPrincipal) {
  return principal.dataScope === 'all' ? undefined : principal.areaIds;
}
function access(principal: AuthPrincipal) {
  return {
    actorId: principal.userId,
    actorName: principal.name,
    roleCodes: principal.roles,
    allowedAreaIds: allowedAreas(principal),
  };
}
