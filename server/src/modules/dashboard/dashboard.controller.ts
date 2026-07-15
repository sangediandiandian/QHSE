import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import type { AuthPrincipal } from '../iam/iam.types';
import { DashboardService } from './dashboard.service';

@ApiTags('驾驶舱')
@ApiBearerAuth()
@Controller('qhse')
export class DashboardController {
  constructor(
    private readonly service: DashboardService,
    private readonly cache: CacheService,
  ) {}

  @Get('dashboard')
  @RequirePermissions(
    'telemetry:read',
    'risk:read',
    'warning:read',
    'emergency:read',
    'resource:read',
    'communication:read',
  )
  snapshot(@CurrentPrincipal() principal: AuthPrincipal) {
    const areaIds = principal.dataScope === 'all' ? undefined : principal.areaIds;
    const scopeKey = areaIds ? [...areaIds].sort().join(',') || 'none' : 'all';
    return this.cache.getOrLoad('dashboard', scopeKey, 15_000, () =>
      this.service.snapshot(areaIds),
    );
  }
}
