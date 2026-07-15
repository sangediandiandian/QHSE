import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '../audit/audit.decorator';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import type { AuthPrincipal } from '../iam/iam.types';
import {
  AddResourceBatchDto,
  CreateResourceDto,
  DispatchResourceDto,
  InspectResourceDto,
  ResourceVersionDto,
} from './emergency-resource.dto';
import { EmergencyResourceService } from './emergency-resource.service';

@ApiTags('应急资源与库存')
@ApiBearerAuth()
@Controller('v1/emergency-resources')
export class EmergencyResourceController {
  constructor(private readonly service: EmergencyResourceService) {}
  @Get() @RequirePermissions('resource:read') list() {
    return this.service.list();
  }
  @Get(':id') @RequirePermissions('resource:read') get(@Param('id') id: string) {
    return this.service.get(id);
  }
  @Post()
  @RequirePermissions('resource:manage')
  @AuditAction({ action: 'resource.create', resourceType: 'emergency_resource' })
  create(@Body() input: CreateResourceDto) {
    return this.service.create(input);
  }
  @Post(':id/batches')
  @RequirePermissions('resource:manage')
  @AuditAction({
    action: 'resource.batch.add',
    resourceType: 'emergency_resource',
    resourceIdParam: 'id',
  })
  addBatch(@Param('id') id: string, @Body() input: AddResourceBatchDto) {
    return this.service.addBatch(id, input);
  }
  @Post(':id/dispatches')
  @RequirePermissions('resource:dispatch')
  @AuditAction({
    action: 'resource.dispatch',
    resourceType: 'emergency_resource',
    resourceIdParam: 'id',
  })
  dispatch(
    @Param('id') id: string,
    @Body() input: DispatchResourceDto,
    @CurrentPrincipal() p: AuthPrincipal,
  ) {
    return this.service.dispatch(id, input, actor(p));
  }
  @Post(':id/dispatches/:dispatchId/arrival')
  @HttpCode(200)
  @RequirePermissions('resource:dispatch')
  @AuditAction({
    action: 'resource.arrive',
    resourceType: 'emergency_resource',
    resourceIdParam: 'id',
  })
  arrive(
    @Param('id') id: string,
    @Param('dispatchId') dispatchId: string,
    @Body() input: ResourceVersionDto,
  ) {
    return this.service.arrive(id, dispatchId, input);
  }
  @Post(':id/dispatches/:dispatchId/return')
  @HttpCode(200)
  @RequirePermissions('resource:dispatch')
  @AuditAction({
    action: 'resource.return',
    resourceType: 'emergency_resource',
    resourceIdParam: 'id',
  })
  return(
    @Param('id') id: string,
    @Param('dispatchId') dispatchId: string,
    @Body() input: ResourceVersionDto,
  ) {
    return this.service.return(id, dispatchId, input);
  }
  @Post(':id/inspections')
  @RequirePermissions('resource:inspect')
  @AuditAction({
    action: 'resource.inspect',
    resourceType: 'emergency_resource',
    resourceIdParam: 'id',
  })
  inspect(
    @Param('id') id: string,
    @Body() input: InspectResourceDto,
    @CurrentPrincipal() p: AuthPrincipal,
  ) {
    return this.service.inspect(id, input, actor(p));
  }
}
const actor = (p: AuthPrincipal) => ({ actorId: p.userId, actorName: p.name });
