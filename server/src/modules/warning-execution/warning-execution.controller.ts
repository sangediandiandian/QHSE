import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { AuditAction } from '../audit/audit.decorator';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import type { AuthPrincipal } from '../iam/iam.types';
import { EvaluateWarningSampleDto } from './dto/evaluate-warning-sample.dto';
import { WarningExecutionService } from './warning-execution.service';
import { CloseWarningSignalDto, WarningSignalVersionDto } from './warning-signal.dto';

class SignalQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

const allowedAreas = (principal: AuthPrincipal) =>
  principal.dataScope === 'all' ? undefined : principal.areaIds;
const access = (principal: AuthPrincipal) => ({
  actorId: principal.userId,
  actorName: principal.name,
  allowedAreaIds: allowedAreas(principal),
});

@ApiTags('预警规则执行')
@ApiBearerAuth()
@Controller('v1/warning-execution')
export class WarningExecutionController {
  constructor(private readonly service: WarningExecutionService) {}

  @Post('samples')
  @RequirePermissions('warning:evaluate')
  @AuditAction({ action: 'warning.sample.evaluate', resourceType: 'warning_sample' })
  @ApiOperation({ summary: '提交标准化采样并执行已发布规则' })
  evaluate(@Body() sample: EvaluateWarningSampleDto) {
    return this.service.evaluate(sample);
  }

  @Get('signals')
  @RequirePermissions('warning:read')
  @ApiOperation({ summary: '查询规则执行产生的预警信号' })
  listSignals(@Query() query: SignalQueryDto, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.service.listSignals(query.limit, allowedAreas(principal));
  }

  @Get('signals/:id')
  @RequirePermissions('warning:read')
  @ApiOperation({ summary: '查询预警信号详情' })
  getSignal(@Param('id') id: string, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.service.getSignal(id, allowedAreas(principal));
  }

  @Post('signals/:id/acknowledge')
  @HttpCode(200)
  @RequirePermissions('warning:handle')
  @AuditAction({
    action: 'warning.signal.acknowledge',
    resourceType: 'warning_signal',
    resourceIdParam: 'id',
  })
  acknowledge(
    @Param('id') id: string,
    @Body() input: WarningSignalVersionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.acknowledge(id, input.expectedVersion, access(principal));
  }

  @Post('signals/:id/handling')
  @HttpCode(200)
  @RequirePermissions('warning:handle')
  @AuditAction({
    action: 'warning.signal.handle',
    resourceType: 'warning_signal',
    resourceIdParam: 'id',
  })
  startHandling(
    @Param('id') id: string,
    @Body() input: WarningSignalVersionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.startHandling(id, input.expectedVersion, access(principal));
  }

  @Post('signals/:id/close')
  @HttpCode(200)
  @RequirePermissions('warning:close')
  @AuditAction({
    action: 'warning.signal.close',
    resourceType: 'warning_signal',
    resourceIdParam: 'id',
  })
  close(
    @Param('id') id: string,
    @Body() input: CloseWarningSignalDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.service.close(id, input.expectedVersion, input.reason, access(principal));
  }
}
