import { Controller, Get, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuditAction } from '../audit/audit.decorator';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import type { AuthPrincipal } from '../iam/iam.types';
import { ReportQueryDto } from './report-query.dto';
import { ReportingService } from './reporting.service';

const areas = (principal: AuthPrincipal) =>
  principal.dataScope === 'all' ? undefined : principal.areaIds;

@ApiTags('统计报表')
@ApiBearerAuth()
@Controller('v1/reports')
export class ReportingController {
  constructor(private readonly service: ReportingService) {}

  @Get('summary')
  @RequirePermissions('report:read')
  summary(@Query() query: ReportQueryDto, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.service.summary(query, areas(principal));
  }

  @Get('summary/export')
  @RequirePermissions('report:export')
  @AuditAction({ action: 'report.export', resourceType: 'report' })
  @ApiProduces('text/csv')
  async export(
    @Query() query: ReportQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
    @Res({ passthrough: true }) response: Response,
  ) {
    const body = await this.service.csv(query, areas(principal));
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Length', String(body.length));
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="qhse-report.csv"; filename*=UTF-8''${encodeURIComponent('QHSE统计报表.csv')}`,
    );
    return new StreamableFile(body);
  }
}
