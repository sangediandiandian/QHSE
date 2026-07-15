import { Body, Controller, Get, Param, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { AuditAction } from '../audit/audit.decorator';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import type { AuthPrincipal } from '../iam/iam.types';
import { ReportQueryDto } from './report-query.dto';
import { ReportingService } from './reporting.service';
import { ReportExportQueueService } from './report-export-queue.service';

const areas = (principal: AuthPrincipal) =>
  principal.dataScope === 'all' ? undefined : principal.areaIds;

@ApiTags('统计报表')
@ApiBearerAuth()
@Controller('v1/reports')
export class ReportingController {
  constructor(
    private readonly service: ReportingService,
    private readonly cache: CacheService,
    private readonly exports: ReportExportQueueService,
  ) {}

  @Get('summary')
  @RequirePermissions('report:read')
  summary(@Query() query: ReportQueryDto, @CurrentPrincipal() principal: AuthPrincipal) {
    const allowedAreaIds = areas(principal);
    const key = Buffer.from(
      JSON.stringify({ query, areas: allowedAreaIds?.slice().sort() || '*' }),
    ).toString('base64url');
    return this.cache.getOrLoad('report-summary', key, 30_000, () =>
      this.service.summary(query, allowedAreaIds),
    );
  }

  @Post('exports')
  @RequirePermissions('report:export')
  @AuditAction({ action: 'report.export.enqueue', resourceType: 'report_export' })
  createExport(@Body() query: ReportQueryDto, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.exports.create({
      ownerId: principal.userId,
      query,
      allowedAreaIds: areas(principal),
    });
  }

  @Get('exports/:id')
  @RequirePermissions('report:export')
  getExport(@Param('id') id: string, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.exports.get(id, principal.userId);
  }

  @Get('exports/:id/content')
  @RequirePermissions('report:export')
  @AuditAction({
    action: 'report.export.download',
    resourceType: 'report_export',
    resourceIdParam: 'id',
  })
  async downloadExport(
    @Param('id') id: string,
    @CurrentPrincipal() principal: AuthPrincipal,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.exports.content(id, principal.userId);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Length', String(result.body.length));
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="qhse-report.csv"; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
    );
    return new StreamableFile(result.body);
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
