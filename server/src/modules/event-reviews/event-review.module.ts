import { Module } from '@nestjs/common';
import { AttachmentModule } from '../attachments/attachment.module';
import { AttachmentService } from '../attachments/attachment.service';
import { EventReviewController } from './event-review.controller';
import { EVENT_REVIEW_REPOSITORY } from './event-review.repository';
import { EventReviewService } from './event-review.service';
import { InMemoryEventReviewRepository } from './in-memory-event-review.repository';
import { PrismaEventReviewRepository } from './prisma-event-review.repository';

@Module({
  imports: [AttachmentModule],
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
      inject: [EVENT_REVIEW_REPOSITORY, AttachmentService],
      useFactory: (
        repository: InMemoryEventReviewRepository | PrismaEventReviewRepository,
        attachments: AttachmentService,
      ) => new EventReviewService(repository, undefined, undefined, attachments),
    },
  ],
  exports: [EventReviewService],
})
export class EventReviewModule {}
