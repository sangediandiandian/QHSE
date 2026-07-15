import { Module } from '@nestjs/common';
import { WarningExecutionModule } from '../warning-execution/warning-execution.module';
import { WarningExecutionService } from '../warning-execution/warning-execution.service';
import { InMemoryTelemetryRepository } from './in-memory-telemetry.repository';
import { PrismaTelemetryRepository } from './prisma-telemetry.repository';
import { TelemetryController } from './telemetry.controller';
import { TELEMETRY_REPOSITORY } from './telemetry.repository';
import { TelemetryService } from './telemetry.service';
@Module({
  imports: [WarningExecutionModule],
  controllers: [TelemetryController],
  providers: [
    InMemoryTelemetryRepository,
    PrismaTelemetryRepository,
    {
      provide: TELEMETRY_REPOSITORY,
      inject: [InMemoryTelemetryRepository, PrismaTelemetryRepository],
      useFactory: (memory: InMemoryTelemetryRepository, prisma: PrismaTelemetryRepository) =>
        process.env.QHSE_REPOSITORY === 'prisma' ? prisma : memory,
    },
    {
      provide: TelemetryService,
      inject: [TELEMETRY_REPOSITORY, WarningExecutionService],
      useFactory: (
        repo: InMemoryTelemetryRepository | PrismaTelemetryRepository,
        warnings: WarningExecutionService,
      ) => new TelemetryService(repo, warnings),
    },
  ],
  exports: [TelemetryService],
})
export class TelemetryModule {}
