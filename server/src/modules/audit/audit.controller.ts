import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@ApiTags('审计日志')
@ApiBearerAuth()
@Controller('v1/audit-logs')
@RequirePermissions('audit:read')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: '查询操作与登录审计日志' })
  list(@Query() query: AuditQueryDto) {
    return this.auditService.list(query);
  }
}
