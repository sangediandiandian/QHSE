import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { AuditAction } from '../audit/audit.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { EvaluateWarningSampleDto } from './dto/evaluate-warning-sample.dto';
import { WarningExecutionService } from './warning-execution.service';

class SignalQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

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
  listSignals(@Query() query: SignalQueryDto) {
    return this.service.listSignals(query.limit);
  }
}
