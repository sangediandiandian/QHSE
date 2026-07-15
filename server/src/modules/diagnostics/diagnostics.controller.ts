import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/permissions.decorator';
import { DiagnosticsService } from './diagnostics.service';

@ApiTags('运行诊断')
@ApiBearerAuth()
@Controller('v1/system/diagnostics')
export class DiagnosticsController {
  constructor(private readonly service: DiagnosticsService) {}

  @Get()
  @RequirePermissions('monitor:read')
  snapshot() {
    return this.service.snapshot();
  }
}
