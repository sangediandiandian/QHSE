import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '../audit/audit.decorator';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import type { AuthPrincipal } from '../iam/iam.types';
import { ReviewWarningRuleDto } from './dto/review-warning-rule.dto';
import { RollbackWarningRuleDto } from './dto/rollback-warning-rule.dto';
import { SaveWarningRuleDto } from './dto/save-warning-rule.dto';
import { ToggleWarningRuleDto } from './dto/toggle-warning-rule.dto';
import { WarningRuleQueryDto } from './dto/warning-rule-query.dto';
import { WarningRuleRevisionDto } from './dto/revision.dto';
import { WarningRuleService } from './warning-rule.service';

@ApiTags('预警规则配置')
@ApiBearerAuth()
@Controller('v1/warning-rules')
export class WarningRuleController {
  constructor(private readonly service: WarningRuleService) {}

  @Get()
  @RequirePermissions('warning:read')
  @ApiOperation({ summary: '查询预警规则' })
  list(@Query() query: WarningRuleQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @RequirePermissions('warning:read')
  @ApiOperation({ summary: '查询预警规则详情' })
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequirePermissions('warning:edit')
  @AuditAction({ action: 'warning_rule.create', resourceType: 'warning_rule' })
  create(@Body() input: SaveWarningRuleDto, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.service.createDraft(input, actor(principal));
  }

  @Put(':id/draft')
  @RequirePermissions('warning:edit')
  @AuditAction({
    action: 'warning_rule.draft.save',
    resourceType: 'warning_rule',
    resourceIdParam: 'id',
  })
  save(@Param('id') id: string, @Body() input: SaveWarningRuleDto) {
    return this.service.saveDraft(id, input);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermissions('warning:submit')
  @AuditAction({
    action: 'warning_rule.submit',
    resourceType: 'warning_rule',
    resourceIdParam: 'id',
  })
  submit(
    @Param('id') id: string,
    @Body() input: WarningRuleRevisionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.submit(id, input, actor(principal));
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions('warning:approve')
  @AuditAction({
    action: 'warning_rule.approve',
    resourceType: 'warning_rule',
    resourceIdParam: 'id',
  })
  approve(
    @Param('id') id: string,
    @Body() input: ReviewWarningRuleDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.approve(id, input, actor(principal));
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions('warning:approve')
  @AuditAction({
    action: 'warning_rule.reject',
    resourceType: 'warning_rule',
    resourceIdParam: 'id',
  })
  reject(
    @Param('id') id: string,
    @Body() input: ReviewWarningRuleDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.reject(id, input, actor(principal));
  }

  @Post(':id/rollback')
  @HttpCode(200)
  @RequirePermissions('warning:edit')
  @AuditAction({
    action: 'warning_rule.rollback',
    resourceType: 'warning_rule',
    resourceIdParam: 'id',
  })
  rollback(@Param('id') id: string, @Body() input: RollbackWarningRuleDto) {
    return this.service.rollback(id, input);
  }

  @Put(':id/enabled')
  @RequirePermissions('warning:toggle')
  @AuditAction({
    action: 'warning_rule.toggle',
    resourceType: 'warning_rule',
    resourceIdParam: 'id',
  })
  toggle(@Param('id') id: string, @Body() input: ToggleWarningRuleDto) {
    return this.service.toggle(id, input);
  }
}

function actor(principal: AuthPrincipal) {
  return { actorId: principal.userId, actorName: principal.name, roleCodes: principal.roles };
}
