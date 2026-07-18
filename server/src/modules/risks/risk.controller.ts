import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { AuditAction } from '../audit/audit.decorator';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import type { AuthPrincipal } from '../iam/iam.types';
import { CreateRiskAssessmentDto } from './dto/create-risk-assessment.dto';
import { RiskQueryDto } from './dto/risk-query.dto';
import { ReviewRiskAssessmentDto } from './dto/review-risk-assessment.dto';
import { UpdateRiskControlsDto } from './dto/update-risk-controls.dto';
import { RiskService } from './risk.service';

function getAllowedAreaIds(principal: AuthPrincipal) {
  return principal.dataScope === 'all' ? undefined : principal.areaIds;
}

@ApiTags('风险分级管控')
@ApiBearerAuth()
@Controller('v1/risks')
export class RiskController {
  constructor(
    private readonly riskService: RiskService,
    private readonly cache: CacheService,
  ) {}

  @Get()
  @RequirePermissions('risk:read')
  @ApiOperation({ summary: '查询风险单元' })
  @ApiOkResponse({ description: '风险单元列表' })
  list(@Query() query: RiskQueryDto, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.riskService.list(query, getAllowedAreaIds(principal));
  }

  @Put(':id/assessments/:assessmentId/review')
  @RequirePermissions('risk:approve')
  @AuditAction({
    action: 'risk.assessment.review',
    resourceType: 'risk',
    resourceIdParam: 'id',
  })
  @ApiOperation({ summary: '异人批准或驳回 LEC 风险评估' })
  async reviewAssessment(
    @Param('id') id: string,
    @Param('assessmentId') assessmentId: string,
    @Body() input: ReviewRiskAssessmentDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    const risk = await this.riskService.reviewAssessment(id, assessmentId, input, {
      actorId: principal.userId,
      actorName: principal.name,
      allowedAreaIds: getAllowedAreaIds(principal),
    });
    await this.cache.invalidate('dashboard');
    return risk;
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
  async assess(
    @Param('id') id: string,
    @Body() input: CreateRiskAssessmentDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    const risk = await this.riskService.assess(id, input, {
      actorId: principal.userId,
      actorName: principal.name,
      allowedAreaIds: getAllowedAreaIds(principal),
    });
    await this.cache.invalidate('dashboard');
    return risk;
  }

  @Put(':id/controls')
  @RequirePermissions('risk:controls:update')
  @AuditAction({ action: 'risk.controls.update', resourceType: 'risk', resourceIdParam: 'id' })
  @HttpCode(200)
  @ApiOperation({ summary: '更新风险管控措施' })
  async saveControls(
    @Param('id') id: string,
    @Body() input: UpdateRiskControlsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    const risk = await this.riskService.saveControls(id, input, {
      actorId: principal.userId,
      actorName: principal.name,
      allowedAreaIds: getAllowedAreaIds(principal),
    });
    await this.cache.invalidate('dashboard');
    return risk;
  }
}
