import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '../audit/audit.decorator';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import type { AuthPrincipal } from '../iam/iam.types';
import {
  IngestTelemetrySampleDto,
  TelemetryHistoryQueryDto,
  TelemetryPointQueryDto,
} from './telemetry.dto';
import { TelemetryService } from './telemetry.service';
@ApiTags('统一遥测接入')
@ApiBearerAuth()
@Controller('v1/telemetry')
export class TelemetryController {
  constructor(private readonly service: TelemetryService) {}
  @Get('points') @RequirePermissions('telemetry:read') list(
    @Query() query: TelemetryPointQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.listPoints(query, areas(principal));
  }
  @Get('points/:id') @RequirePermissions('telemetry:read') get(
    @Param('id') id: string,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.getPoint(id, areas(principal));
  }
  @Get('points/:id/samples') @RequirePermissions('telemetry:read') history(
    @Param('id') id: string,
    @Query() query: TelemetryHistoryQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.history(id, query.limit, areas(principal));
  }
  @Post('samples')
  @RequirePermissions('telemetry:ingest')
  @AuditAction({ action: 'telemetry.sample.ingest', resourceType: 'telemetry_sample' })
  ingest(@Body() input: IngestTelemetrySampleDto, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.service.ingest(input, areas(principal));
  }
}
const areas = (principal: AuthPrincipal) =>
  principal.dataScope === 'all' ? undefined : principal.areaIds;
