import { Module } from '@nestjs/common';
import { RiskModule } from '../risks/risk.module';
import { HazardController } from './hazard.controller';
import { InMemoryHazardRepository } from './in-memory-hazard.repository';
import { PrismaHazardRepository } from './prisma-hazard.repository';
import { HAZARD_REPOSITORY } from './hazard.repository';
import { HazardService } from './hazard.service';
import { RiskService } from '../risks/risk.service';
import { AttachmentModule } from '../attachments/attachment.module';
import { AttachmentService } from '../attachments/attachment.service';
import { HazardReminderScheduler } from './hazard-reminder.scheduler';

@Module({
  imports: [RiskModule, AttachmentModule],
  controllers: [HazardController],
  providers: [
    InMemoryHazardRepository,
    PrismaHazardRepository,
    {
      provide: HAZARD_REPOSITORY,
      inject: [InMemoryHazardRepository, PrismaHazardRepository],
      useFactory: (memory: InMemoryHazardRepository, prisma: PrismaHazardRepository) =>
        process.env.QHSE_REPOSITORY === 'prisma' ? prisma : memory,
    },
    {
      provide: HazardService,
      inject: [HAZARD_REPOSITORY, RiskService, AttachmentService],
      useFactory: (
        repository: InMemoryHazardRepository | PrismaHazardRepository,
        riskService: RiskService,
        attachmentService: AttachmentService,
      ) => new HazardService(repository, riskService, {}, attachmentService),
    },
    HazardReminderScheduler,
  ],
  exports: [HazardService],
})
export class HazardModule {}
