import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuditAction } from '../audit/audit.decorator';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import type { AuthPrincipal } from '../iam/iam.types';
import {
  AddEventReviewEvidenceDto,
  AdvanceReviewActionDto,
  EventReviewVersionDto,
  LinkReviewActionHazardDto,
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

  @Get(':id/report')
  @RequirePermissions('emergency:read', 'report:export')
  @AuditAction({
    action: 'event_review.report.download',
    resourceType: 'event_review',
    resourceIdParam: 'id',
  })
  @ApiProduces('text/html')
  async report(
    @Param('id') id: string,
    @CurrentPrincipal() principal: AuthPrincipal,
    @Res({ passthrough: true }) response: Response,
  ) {
    const report = await this.service.report(id, principal.name, allowedAreas(principal));
    response.setHeader('Content-Type', report.contentType);
    response.setHeader('Content-Length', String(report.body.length));
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="event-review.html"; filename*=UTF-8''${encodeURIComponent(report.filename)}`,
    );
    return new StreamableFile(report.body);
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

  @Post(':id/actions/:actionId/hazard')
  @RequirePermissions('emergency:manage', 'hazard:report')
  @AuditAction({
    action: 'event_review.action.hazard.link',
    resourceType: 'event_review',
    resourceIdParam: 'id',
  })
  linkActionHazard(
    @Param('id') id: string,
    @Param('actionId') actionId: string,
    @Body() input: LinkReviewActionHazardDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.linkActionToHazard(id, actionId, input, access(principal));
  }

  @Post(':id/actions/hazards/sync')
  @HttpCode(200)
  @RequirePermissions('emergency:manage', 'hazard:read')
  @AuditAction({
    action: 'event_review.action.hazard.sync',
    resourceType: 'event_review',
    resourceIdParam: 'id',
  })
  syncActionHazards(
    @Param('id') id: string,
    @Body() input: EventReviewVersionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.syncActionHazards(id, input.expectedVersion, access(principal));
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
