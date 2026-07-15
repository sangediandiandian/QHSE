import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '../audit/audit.decorator';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import type { AuthPrincipal } from '../iam/iam.types';
import { CommunicationReceiptDto, CommunicationVersionDto } from './communication.dto';
import { CommunicationService } from './communication.service';
const actor = (principal: AuthPrincipal) => ({
  actorId: principal.userId,
  actorName: principal.name,
});
@ApiTags('融合通信')
@ApiBearerAuth()
@Controller('v1/communications')
export class CommunicationController {
  constructor(private readonly service: CommunicationService) {}
  @Get() @RequirePermissions('communication:read') list() {
    return this.service.list();
  }
  @Get(':eventId') @RequirePermissions('communication:read') get(
    @Param('eventId') eventId: string,
  ) {
    return this.service.get(eventId);
  }
  @Post(':eventId/escalate')
  @RequirePermissions('communication:send')
  @AuditAction({
    action: 'communication.escalate',
    resourceType: 'communication',
    resourceIdParam: 'eventId',
  })
  escalate(
    @Param('eventId') eventId: string,
    @Body() input: CommunicationVersionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.escalate(eventId, input, actor(principal));
  }
  @Post(':eventId/tasks/:taskId/confirm')
  @RequirePermissions('communication:confirm')
  @AuditAction({
    action: 'communication.confirm',
    resourceType: 'communication',
    resourceIdParam: 'eventId',
  })
  confirm(
    @Param('taskId') taskId: string,
    @Body() input: CommunicationVersionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.confirm(taskId, input, actor(principal));
  }
  @Post(':eventId/tasks/:taskId/receipt')
  @RequirePermissions('communication:send')
  @AuditAction({
    action: 'communication.receipt',
    resourceType: 'communication',
    resourceIdParam: 'eventId',
  })
  receipt(@Param('taskId') taskId: string, @Body() input: CommunicationReceiptDto) {
    return this.service.receipt(taskId, input);
  }
}
