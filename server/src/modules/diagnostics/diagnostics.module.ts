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
import { SessionStoreService } from '../../infrastructure/session/session-store.service';
import { TracingService } from '../../infrastructure/tracing/tracing.service';
import { IamModule } from '../iam/iam.module';
import { IamChangeBusService } from '../iam/iam-change-bus.service';

@Global()
@Module({
  imports: [PlatformConfigModule, ReportingModule, IamModule],
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
        SessionStoreService,
        TracingService,
        IamChangeBusService,
      ],
      useFactory: (
        metrics: RuntimeMetricsService,
        config: PlatformConfigService,
        cache: CacheService,
        queue: ReportExportQueueService,
        sessions: SessionStoreService,
        tracing: TracingService,
        iamChanges: IamChangeBusService,
      ) => new DiagnosticsService(metrics, config, cache, queue, sessions, tracing, iamChanges),
    },
  ],
  exports: [RuntimeMetricsService, RuntimeMetricsMiddleware],
})
export class DiagnosticsModule {}
