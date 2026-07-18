import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '../audit/audit.decorator';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import type { AuthPrincipal } from '../iam/iam.types';
import { AdvanceReviewActionDto, EventReviewVersionDto } from './event-review.dto';
import { EventReviewService } from './event-review.service';

function allowedAreas(principal: AuthPrincipal) {
  return principal.dataScope === 'all' ? undefined : principal.areaIds;
}

function access(principal: AuthPrincipal) {
  return {
    actorId: principal.userId,
    actorName: principal.name,
    allowedAreaIds: allowedAreas(principal),
  };
}

@ApiTags('事件调查复盘')
@ApiBearerAuth()
@Controller('v1/event-reviews')
export class EventReviewController {
  constructor(private readonly service: EventReviewService) {}

  @Get()
  @RequirePermissions('emergency:read')
  list(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.service.list(allowedAreas(principal));
  }

  @Get(':id')
  @RequirePermissions('emergency:read')
  get(@Param('id') id: string, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.service.get(id, allowedAreas(principal));
  }

  @Post(':id/actions/advance')
  @HttpCode(200)
  @RequirePermissions('emergency:manage')
  @AuditAction({
    action: 'event_review.action.advance',
    resourceType: 'event_review',
    resourceIdParam: 'id',
  })
  advance(
    @Param('id') id: string,
    @Body() input: AdvanceReviewActionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.advanceAction(id, input.actionId, input.expectedVersion, access(principal));
  }

  @Post(':id/close')
  @HttpCode(200)
  @RequirePermissions('emergency:approve')
  @AuditAction({
    action: 'event_review.close',
    resourceType: 'event_review',
    resourceIdParam: 'id',
  })
  close(
    @Param('id') id: string,
    @Body() input: EventReviewVersionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.close(id, input.expectedVersion, access(principal));
  }
}
