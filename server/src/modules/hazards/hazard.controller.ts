import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuditAction } from '../audit/audit.decorator';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import type { AuthPrincipal } from '../iam/iam.types';
import { AddHazardEvidenceDto } from './dto/add-hazard-evidence.dto';
import { CloseHazardDto } from './dto/close-hazard.dto';
import { CreateHazardDto } from './dto/create-hazard.dto';
import { HazardQueryDto } from './dto/hazard-query.dto';
import { UpdateHazardSupervisionDto } from './dto/update-hazard-supervision.dto';
import { VersionDto } from './dto/version.dto';
import { HazardService } from './hazard.service';

function getAllowedAreaIds(principal: AuthPrincipal) {
  return principal.dataScope === 'all' ? undefined : principal.areaIds;
}

function getAccess(principal: AuthPrincipal) {
  return {
    actorId: principal.userId,
    actorName: principal.name,
    allowedAreaIds: getAllowedAreaIds(principal),
  };
}

@ApiTags('隐患排查治理')
@ApiBearerAuth()
@Controller('v1/hazards')
export class HazardController {
  constructor(private readonly hazardService: HazardService) {}

  @Get()
  @RequirePermissions('hazard:read')
  @ApiOperation({ summary: '查询隐患台账' })
  @ApiOkResponse({ description: '按权限数据范围过滤后的隐患列表' })
  list(@Query() query: HazardQueryDto, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.hazardService.list(query, getAllowedAreaIds(principal));
  }

  @Get(':id')
  @RequirePermissions('hazard:read')
  @ApiOperation({ summary: '查询隐患详情' })
  get(@Param('id') id: string, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.hazardService.get(id, getAllowedAreaIds(principal));
  }

  @Post()
  @RequirePermissions('hazard:report')
  @AuditAction({ action: 'hazard.create', resourceType: 'hazard' })
  @ApiOperation({ summary: '上报隐患' })
  @ApiCreatedResponse({ description: '已生成整改任务的隐患' })
  create(@Body() input: CreateHazardDto, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.hazardService.create(input, getAccess(principal));
  }

  @Post('reminders/run')
  @RequirePermissions('hazard:supervise')
  @AuditAction({ action: 'hazard.reminders.run', resourceType: 'hazard' })
  @HttpCode(200)
  @ApiOperation({ summary: '执行临期与逾期隐患幂等催办扫描' })
  runReminders(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.hazardService.runReminders(getAccess(principal));
  }

  @Post(':id/evidence')
  @RequirePermissions('hazard:rectify')
  @AuditAction({ action: 'hazard.evidence.add', resourceType: 'hazard', resourceIdParam: 'id' })
  @ApiOperation({ summary: '添加整改证据' })
  addEvidence(
    @Param('id') id: string,
    @Body() input: AddHazardEvidenceDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.hazardService.addEvidence(id, input, getAccess(principal));
  }

  @Post(':id/rectification/start')
  @RequirePermissions('hazard:rectify')
  @AuditAction({
    action: 'hazard.rectification.start',
    resourceType: 'hazard',
    resourceIdParam: 'id',
  })
  @HttpCode(200)
  @ApiOperation({ summary: '开始整改' })
  start(
    @Param('id') id: string,
    @Body() input: VersionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.hazardService.start(id, input, getAccess(principal));
  }

  @Post(':id/acceptance/submit')
  @RequirePermissions('hazard:rectify')
  @AuditAction({
    action: 'hazard.acceptance.submit',
    resourceType: 'hazard',
    resourceIdParam: 'id',
  })
  @HttpCode(200)
  @ApiOperation({ summary: '提交隐患验收' })
  submit(
    @Param('id') id: string,
    @Body() input: VersionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.hazardService.submit(id, input, getAccess(principal));
  }

  @Post(':id/acceptance/close')
  @RequirePermissions('hazard:accept')
  @AuditAction({ action: 'hazard.acceptance.close', resourceType: 'hazard', resourceIdParam: 'id' })
  @HttpCode(200)
  @ApiOperation({ summary: '验收并关闭隐患' })
  close(
    @Param('id') id: string,
    @Body() input: CloseHazardDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.hazardService.close(id, input, getAccess(principal));
  }

  @Put(':id/supervision')
  @RequirePermissions('hazard:supervise')
  @AuditAction({
    action: 'hazard.supervision.update',
    resourceType: 'hazard',
    resourceIdParam: 'id',
  })
  @ApiOperation({ summary: '设置挂牌督办状态' })
  updateSupervision(
    @Param('id') id: string,
    @Body() input: UpdateHazardSupervisionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.hazardService.updateSupervision(id, input, getAccess(principal));
  }
}
