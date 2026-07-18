import { Module } from '@nestjs/common';
import { CacheModule } from '../infrastructure/cache/cache.module';
import { CacheService } from '../infrastructure/cache/cache.service';
import { SessionModule } from '../infrastructure/session/session.module';
import { SessionStoreService } from '../infrastructure/session/session-store.service';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import { ReportingModule } from '../modules/reporting/reporting.module';
import { ReportExportQueueService } from '../modules/reporting/report-export-queue.service';
import { IamModule } from '../modules/iam/iam.module';
import { IamChangeBusService } from '../modules/iam/iam-change-bus.service';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [DatabaseModule, CacheModule, SessionModule, ReportingModule, IamModule],
  controllers: [HealthController],
  providers: [
    {
      provide: HealthService,
      inject: [
        PrismaService,
        CacheService,
        SessionStoreService,
        ReportExportQueueService,
        IamChangeBusService,
      ],
      useFactory: (
        prisma: PrismaService,
        cache: CacheService,
        sessions: SessionStoreService,
        queue: ReportExportQueueService,
        iamChanges: IamChangeBusService,
      ) => new HealthService(prisma, cache, sessions, queue, iamChanges),
    },
  ],
})
export class HealthModule {}
