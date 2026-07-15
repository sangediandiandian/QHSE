import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WarningExecutionModule } from '../warning-execution/warning-execution.module';
import { WarningExecutionService } from '../warning-execution/warning-execution.service';
import { InMemoryTelemetryRepository } from './in-memory-telemetry.repository';
import { PrismaTelemetryRepository } from './prisma-telemetry.repository';
import { TelemetryController } from './telemetry.controller';
import { TELEMETRY_REPOSITORY } from './telemetry.repository';
import { TelemetryService } from './telemetry.service';
import { TelemetryGateway } from './telemetry.gateway';
import { TelemetryMqttAdapter } from './telemetry-mqtt.adapter';
import { TelemetryStreamService } from './telemetry-stream.service';
@Module({
  imports: [WarningExecutionModule, AuthModule],
  controllers: [TelemetryController],
  providers: [
    InMemoryTelemetryRepository,
    PrismaTelemetryRepository,
    TelemetryStreamService,
    {
      provide: TELEMETRY_REPOSITORY,
      inject: [InMemoryTelemetryRepository, PrismaTelemetryRepository],
      useFactory: (memory: InMemoryTelemetryRepository, prisma: PrismaTelemetryRepository) =>
        process.env.QHSE_REPOSITORY === 'prisma' ? prisma : memory,
    },
    {
      provide: TelemetryService,
      inject: [TELEMETRY_REPOSITORY, WarningExecutionService, TelemetryStreamService],
      useFactory: (
        repo: InMemoryTelemetryRepository | PrismaTelemetryRepository,
        warnings: WarningExecutionService,
        stream: TelemetryStreamService,
      ) => new TelemetryService(repo, warnings, () => new Date(), stream),
    },
    TelemetryMqttAdapter,
    TelemetryGateway,
  ],
  exports: [TelemetryService],
})
export class TelemetryModule {}
