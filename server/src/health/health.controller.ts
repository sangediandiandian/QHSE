import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../modules/auth/public.decorator';
import { HealthService } from './health.service';

@ApiTags('系统')
@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly service: HealthService) {}

  @Get()
  @ApiOperation({ summary: '服务健康检查' })
  getHealth() {
    return {
      service: 'qhse-api',
      status: 'ok',
      uptime: Math.floor(process.uptime()),
    };
  }

  @Get('live')
  @ApiOperation({ summary: '容器存活探针' })
  liveness() {
    return this.service.liveness();
  }

  @Get('ready')
  @ApiOperation({ summary: '容器就绪探针' })
  readiness() {
    return this.service.readiness();
  }
}
