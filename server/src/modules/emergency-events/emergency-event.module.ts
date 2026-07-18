import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { IamService } from '../iam/iam.service';
import { WorkflowModule } from '../workflows/workflow.module';
import { WorkflowService } from '../workflows/workflow.service';
import { EmergencyEventController } from './emergency-event.controller';
import { InMemoryEmergencyEventRepository } from './in-memory-emergency-event.repository';
import { PrismaEmergencyEventRepository } from './prisma-emergency-event.repository';
import { EMERGENCY_EVENT_REPOSITORY } from './emergency-event.repository';
import { EmergencyEventService } from './emergency-event.service';
import { AttachmentModule } from '../attachments/attachment.module';
import { AttachmentService } from '../attachments/attachment.service';
import { EventReviewModule } from '../event-reviews/event-review.module';
import { EventReviewService } from '../event-reviews/event-review.service';

@Module({
  imports: [IamModule, WorkflowModule, AttachmentModule, EventReviewModule],
  controllers: [EmergencyEventController],
  providers: [
    InMemoryEmergencyEventRepository,
    PrismaEmergencyEventRepository,
    {
      provide: EMERGENCY_EVENT_REPOSITORY,
      inject: [InMemoryEmergencyEventRepository, PrismaEmergencyEventRepository],
      useFactory: (
        memory: InMemoryEmergencyEventRepository,
        prisma: PrismaEmergencyEventRepository,
      ) => (process.env.QHSE_REPOSITORY === 'prisma' ? prisma : memory),
    },
    {
      provide: EmergencyEventService,
      inject: [
        EMERGENCY_EVENT_REPOSITORY,
        WorkflowService,
        IamService,
        AttachmentService,
        EventReviewService,
      ],
      useFactory: (
        repository: InMemoryEmergencyEventRepository | PrismaEmergencyEventRepository,
        workflows: WorkflowService,
        iam: IamService,
        attachmentService: AttachmentService,
        eventReviews: EventReviewService,
      ) =>
        new EmergencyEventService(repository, workflows, iam, {}, attachmentService, eventReviews),
    },
  ],
  exports: [EmergencyEventService],
})
export class EmergencyEventModule {}
