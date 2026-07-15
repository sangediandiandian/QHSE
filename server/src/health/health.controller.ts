import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../modules/auth/public.decorator';

@ApiTags('系统')
@Controller('health')
@Public()
export class HealthController {
  @Get()
  @ApiOperation({ summary: '服务健康检查' })
  getHealth() {
    return {
      service: 'qhse-api',
      status: 'ok',
      uptime: Math.floor(process.uptime()),
    };
  }
}
