import { Module } from '@nestjs/common';
import { AttachmentModule } from '../attachments/attachment.module';
import { AttachmentService } from '../attachments/attachment.service';
import { HazardModule } from '../hazards/hazard.module';
import { HazardService } from '../hazards/hazard.service';
import { EventReviewController } from './event-review.controller';
import { EVENT_REVIEW_REPOSITORY } from './event-review.repository';
import { EventReviewService } from './event-review.service';
import { InMemoryEventReviewRepository } from './in-memory-event-review.repository';
import { PrismaEventReviewRepository } from './prisma-event-review.repository';

@Module({
  imports: [AttachmentModule, HazardModule],
  controllers: [EventReviewController],
  providers: [
    InMemoryEventReviewRepository,
    PrismaEventReviewRepository,
    {
      provide: EVENT_REVIEW_REPOSITORY,
      inject: [InMemoryEventReviewRepository, PrismaEventReviewRepository],
      useFactory: (memory: InMemoryEventReviewRepository, prisma: PrismaEventReviewRepository) =>
        process.env.QHSE_REPOSITORY === 'prisma' ? prisma : memory,
    },
    {
      provide: EventReviewService,
      inject: [EVENT_REVIEW_REPOSITORY, AttachmentService, HazardService],
      useFactory: (
        repository: InMemoryEventReviewRepository | PrismaEventReviewRepository,
        attachments: AttachmentService,
        hazards: HazardService,
      ) => new EventReviewService(repository, undefined, undefined, attachments, hazards),
    },
  ],
  exports: [EventReviewService],
})
export class EventReviewModule {}
