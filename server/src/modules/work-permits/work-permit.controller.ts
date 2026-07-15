import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '../audit/audit.decorator';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import type { AuthPrincipal } from '../iam/iam.types';
import { ConfirmWorkPermitSiteDto } from './dto/confirm-site.dto';
import { CreateWorkPermitDto } from './dto/create-work-permit.dto';
import { RecommendWorkPermitPauseDto } from './dto/recommend-pause.dto';
import { ResumeWorkPermitDto } from './dto/resume-work-permit.dto';
import { WorkPermitVersionDto } from './dto/version.dto';
import { WorkPermitQueryDto } from './dto/work-permit-query.dto';
import { WorkPermitService } from './work-permit.service';

@ApiTags('作业许可管理')
@ApiBearerAuth()
@Controller('v1/work-permits')
export class WorkPermitController {
  constructor(private readonly service: WorkPermitService) {}

  @Get()
  @RequirePermissions('permit:read')
  @ApiOperation({ summary: '查询作业票台账' })
  list(@Query() query: WorkPermitQueryDto, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.service.list(query, allowedAreas(principal));
  }

  @Get(':id')
  @RequirePermissions('permit:read')
  @ApiOperation({ summary: '查询作业票详情' })
  get(@Param('id') id: string, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.service.get(id, allowedAreas(principal));
  }

  @Post()
  @RequirePermissions('permit:apply')
  @AuditAction({ action: 'permit.create', resourceType: 'work_permit' })
  create(@Body() input: CreateWorkPermitDto, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.service.create(input, access(principal));
  }

  @Post(':id/approvals/next')
  @HttpCode(200)
  @RequirePermissions('permit:approve')
  @AuditAction({ action: 'permit.approve', resourceType: 'work_permit', resourceIdParam: 'id' })
  approve(
    @Param('id') id: string,
    @Body() input: WorkPermitVersionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.approveNext(id, input, access(principal));
  }

  @Post(':id/site-confirmations')
  @HttpCode(200)
  @RequirePermissions('permit:confirm')
  @AuditAction({
    action: 'permit.site.confirm',
    resourceType: 'work_permit',
    resourceIdParam: 'id',
  })
  confirm(
    @Param('id') id: string,
    @Body() input: ConfirmWorkPermitSiteDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.confirmSite(id, input, access(principal));
  }

  @Post(':id/pause-recommendation')
  @HttpCode(200)
  @RequirePermissions('permit:control')
  @AuditAction({
    action: 'permit.pause.recommend',
    resourceType: 'work_permit',
    resourceIdParam: 'id',
  })
  recommendPause(
    @Param('id') id: string,
    @Body() input: RecommendWorkPermitPauseDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.recommendPause(id, input, access(principal));
  }

  @Post(':id/pause')
  @HttpCode(200)
  @RequirePermissions('permit:control')
  @AuditAction({ action: 'permit.pause', resourceType: 'work_permit', resourceIdParam: 'id' })
  pause(
    @Param('id') id: string,
    @Body() input: WorkPermitVersionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.pause(id, input, access(principal));
  }

  @Post(':id/resume')
  @HttpCode(200)
  @RequirePermissions('permit:control')
  @AuditAction({ action: 'permit.resume', resourceType: 'work_permit', resourceIdParam: 'id' })
  resume(
    @Param('id') id: string,
    @Body() input: ResumeWorkPermitDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.resume(id, input, access(principal));
  }

  @Post(':id/close')
  @HttpCode(200)
  @RequirePermissions('permit:control')
  @AuditAction({ action: 'permit.close', resourceType: 'work_permit', resourceIdParam: 'id' })
  close(
    @Param('id') id: string,
    @Body() input: WorkPermitVersionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.close(id, input, access(principal));
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
