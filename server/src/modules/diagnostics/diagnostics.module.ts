import { Global, Module } from '@nestjs/common';
import { PlatformConfigModule } from '../platform-config/platform-config.module';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { DiagnosticsController } from './diagnostics.controller';
import { DiagnosticsService } from './diagnostics.service';
import { RuntimeMetricsMiddleware } from './runtime-metrics.middleware';
import { RuntimeMetricsService } from './runtime-metrics.service';

@Global()
@Module({
  imports: [PlatformConfigModule],
  controllers: [DiagnosticsController],
  providers: [
    RuntimeMetricsService,
    RuntimeMetricsMiddleware,
    {
      provide: DiagnosticsService,
      inject: [RuntimeMetricsService, PlatformConfigService],
      useFactory: (metrics: RuntimeMetricsService, config: PlatformConfigService) =>
        new DiagnosticsService(metrics, config),
    },
  ],
  exports: [RuntimeMetricsService, RuntimeMetricsMiddleware],
})
export class DiagnosticsModule {}
