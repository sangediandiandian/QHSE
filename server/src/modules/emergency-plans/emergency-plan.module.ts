import { Module } from '@nestjs/common';
import { WorkflowModule } from '../workflows/workflow.module';
import { WorkflowService } from '../workflows/workflow.service';
import { EmergencyPlanController } from './emergency-plan.controller';
import { EmergencyPlanService } from './emergency-plan.service';
import { EMERGENCY_PLAN_REPOSITORY } from './emergency-plan.repository';
import { InMemoryEmergencyPlanRepository } from './in-memory-emergency-plan.repository';
import { PrismaEmergencyPlanRepository } from './prisma-emergency-plan.repository';
@Module({
  imports: [WorkflowModule],
  controllers: [EmergencyPlanController],
  providers: [
    InMemoryEmergencyPlanRepository,
    PrismaEmergencyPlanRepository,
    {
      provide: EMERGENCY_PLAN_REPOSITORY,
      inject: [InMemoryEmergencyPlanRepository, PrismaEmergencyPlanRepository],
      useFactory: (
        memory: InMemoryEmergencyPlanRepository,
        prisma: PrismaEmergencyPlanRepository,
      ) => (process.env.QHSE_REPOSITORY === 'prisma' ? prisma : memory),
    },
    {
      provide: EmergencyPlanService,
      inject: [EMERGENCY_PLAN_REPOSITORY, WorkflowService],
      useFactory: (
        repo: InMemoryEmergencyPlanRepository | PrismaEmergencyPlanRepository,
        workflows: WorkflowService,
      ) => new EmergencyPlanService(repo, workflows),
    },
  ],
  exports: [EmergencyPlanService],
})
export class EmergencyPlanModule {}
