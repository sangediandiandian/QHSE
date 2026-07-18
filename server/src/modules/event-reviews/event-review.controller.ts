import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '../audit/audit.decorator';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import type { AuthPrincipal } from '../iam/iam.types';
import {
  AddEventReviewEvidenceDto,
  AdvanceReviewActionDto,
  EventReviewVersionDto,
  SaveEventReviewActionDto,
  UpdateEventReviewAnalysisDto,
} from './event-review.dto';
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

  @Put(':id/analysis')
  @RequirePermissions('emergency:manage')
  @AuditAction({
    action: 'event_review.analysis.update',
    resourceType: 'event_review',
    resourceIdParam: 'id',
  })
  updateAnalysis(
    @Param('id') id: string,
    @Body() input: UpdateEventReviewAnalysisDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.updateAnalysis(id, input, access(principal));
  }

  @Post(':id/evidence')
  @RequirePermissions('emergency:evidence')
  @AuditAction({
    action: 'event_review.evidence.add',
    resourceType: 'event_review',
    resourceIdParam: 'id',
  })
  addEvidence(
    @Param('id') id: string,
    @Body() input: AddEventReviewEvidenceDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.addEvidence(id, input, access(principal));
  }

  @Post(':id/actions')
  @RequirePermissions('emergency:manage')
  @AuditAction({
    action: 'event_review.action.create',
    resourceType: 'event_review',
    resourceIdParam: 'id',
  })
  addAction(
    @Param('id') id: string,
    @Body() input: SaveEventReviewActionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.addAction(id, input, access(principal));
  }

  @Put(':id/actions/:actionId')
  @RequirePermissions('emergency:manage')
  @AuditAction({
    action: 'event_review.action.update',
    resourceType: 'event_review',
    resourceIdParam: 'id',
  })
  updateAction(
    @Param('id') id: string,
    @Param('actionId') actionId: string,
    @Body() input: SaveEventReviewActionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.updateAction(id, actionId, input, access(principal));
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
