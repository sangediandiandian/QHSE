import { Module } from '@nestjs/common';
import { EmergencyPlanModule } from '../emergency-plans/emergency-plan.module';
import { EmergencyPlanService } from '../emergency-plans/emergency-plan.service';
import { EventReviewModule } from '../event-reviews/event-review.module';
import { EventReviewService } from '../event-reviews/event-review.service';
import { HazardModule } from '../hazards/hazard.module';
import { HazardService } from '../hazards/hazard.service';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

@Module({
  imports: [EventReviewModule, HazardModule, EmergencyPlanModule],
  controllers: [KnowledgeController],
  providers: [
    {
      provide: KnowledgeService,
      inject: [EventReviewService, HazardService, EmergencyPlanService],
      useFactory: (
        reviews: EventReviewService,
        hazards: HazardService,
        plans: EmergencyPlanService,
      ) => new KnowledgeService(reviews, hazards, plans),
    },
  ],
})
export class KnowledgeModule {}
