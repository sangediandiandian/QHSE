import { Module } from '@nestjs/common';
import { EventReviewController } from './event-review.controller';
import { EVENT_REVIEW_REPOSITORY } from './event-review.repository';
import { EventReviewService } from './event-review.service';
import { InMemoryEventReviewRepository } from './in-memory-event-review.repository';
import { PrismaEventReviewRepository } from './prisma-event-review.repository';

@Module({
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
      inject: [EVENT_REVIEW_REPOSITORY],
      useFactory: (repository: InMemoryEventReviewRepository | PrismaEventReviewRepository) =>
        new EventReviewService(repository),
    },
  ],
  exports: [EventReviewService],
})
export class EventReviewModule {}
