import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '../audit/audit.decorator';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import type { AuthPrincipal } from '../iam/iam.types';
import { CreateRiskAssessmentDto } from './dto/create-risk-assessment.dto';
import { RiskQueryDto } from './dto/risk-query.dto';
import { UpdateRiskControlsDto } from './dto/update-risk-controls.dto';
import { RiskService } from './risk.service';

@ApiTags('风险分级管控')
@ApiBearerAuth()
@Controller('v1/risks')
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Get()
  @RequirePermissions('risk:read')
  @ApiOperation({ summary: '查询风险单元' })
  @ApiOkResponse({ description: '风险单元列表' })
  list(@Query() query: RiskQueryDto, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.riskService.list(query, getAllowedAreaIds(principal));
  }

  @Get(':id')
  @RequirePermissions('risk:read')
  @ApiOperation({ summary: '查询风险单元详情' })
  get(@Param('id') id: string, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.riskService.get(id, getAllowedAreaIds(principal));
  }

  @Post(':id/assessments')
  @RequirePermissions('risk:assess')
  @AuditAction({ action: 'risk.assess', resourceType: 'risk', resourceIdParam: 'id' })
  @ApiOperation({ summary: '提交 LEC 风险评估' })
  @ApiCreatedResponse({ description: '评估完成后的风险单元' })
  assess(
    @Param('id') id: string,
    @Body() input: CreateRiskAssessmentDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.riskService.assess(id, input, {
      actorId: principal.userId,
      actorName: principal.name,
      allowedAreaIds: getAllowedAreaIds(principal),
    });
  }

  @Put(':id/controls')
  @RequirePermissions('risk:controls:update')
  @AuditAction({ action: 'risk.controls.update', resourceType: 'risk', resourceIdParam: 'id' })
  @HttpCode(200)
  @ApiOperation({ summary: '更新风险管控措施' })
  saveControls(
    @Param('id') id: string,
    @Body() input: UpdateRiskControlsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.riskService.saveControls(id, input, {
      actorId: principal.userId,
      actorName: principal.name,
      allowedAreaIds: getAllowedAreaIds(principal),
    });
  }
}

function getAllowedAreaIds(principal: AuthPrincipal) {
  return principal.dataScope === 'all' ? undefined : principal.areaIds;
}
