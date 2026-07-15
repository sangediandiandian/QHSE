import { Global, Module } from '@nestjs/common';
import { PlatformConfigModule } from '../platform-config/platform-config.module';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { DiagnosticsController } from './diagnostics.controller';
import { DiagnosticsService } from './diagnostics.service';
import { RuntimeMetricsMiddleware } from './runtime-metrics.middleware';
import { RuntimeMetricsService } from './runtime-metrics.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { ReportingModule } from '../reporting/reporting.module';
import { ReportExportQueueService } from '../reporting/report-export-queue.service';

@Global()
@Module({
  imports: [PlatformConfigModule, ReportingModule],
  controllers: [DiagnosticsController],
  providers: [
    RuntimeMetricsService,
    RuntimeMetricsMiddleware,
    {
      provide: DiagnosticsService,
      inject: [
        RuntimeMetricsService,
        PlatformConfigService,
        CacheService,
        ReportExportQueueService,
      ],
      useFactory: (
        metrics: RuntimeMetricsService,
        config: PlatformConfigService,
        cache: CacheService,
        queue: ReportExportQueueService,
      ) => new DiagnosticsService(metrics, config, cache, queue),
    },
  ],
  exports: [RuntimeMetricsService, RuntimeMetricsMiddleware],
})
export class DiagnosticsModule {}
