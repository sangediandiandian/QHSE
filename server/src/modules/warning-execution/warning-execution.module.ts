import { Module } from '@nestjs/common';
import { EmergencyEventModule } from '../emergency-events/emergency-event.module';
import { EmergencyEventService } from '../emergency-events/emergency-event.service';
import { WorkPermitModule } from '../work-permits/work-permit.module';
import { WorkPermitService } from '../work-permits/work-permit.service';
import { WarningRuleModule } from '../warning-rules/warning-rule.module';
import { WarningRuleService } from '../warning-rules/warning-rule.service';
import { InMemoryWarningExecutionRepository } from './in-memory-warning-execution.repository';
import { PrismaWarningExecutionRepository } from './prisma-warning-execution.repository';
import { WarningExecutionController } from './warning-execution.controller';
import { WARNING_EXECUTION_REPOSITORY } from './warning-execution.repository';
import { WarningExecutionService } from './warning-execution.service';

@Module({
  imports: [WarningRuleModule, WorkPermitModule, EmergencyEventModule],
  controllers: [WarningExecutionController],
  providers: [
    InMemoryWarningExecutionRepository,
    PrismaWarningExecutionRepository,
    {
      provide: WARNING_EXECUTION_REPOSITORY,
      inject: [InMemoryWarningExecutionRepository, PrismaWarningExecutionRepository],
      useFactory: (
        memory: InMemoryWarningExecutionRepository,
        prisma: PrismaWarningExecutionRepository,
      ) => (process.env.QHSE_REPOSITORY === 'prisma' ? prisma : memory),
    },
    {
      provide: WarningExecutionService,
      inject: [
        WARNING_EXECUTION_REPOSITORY,
        WarningRuleService,
        WorkPermitService,
        EmergencyEventService,
      ],
      useFactory: (
        repository: InMemoryWarningExecutionRepository | PrismaWarningExecutionRepository,
        rules: WarningRuleService,
        permits: WorkPermitService,
        emergencies: EmergencyEventService,
      ) => new WarningExecutionService(repository, rules, permits, {}, emergencies),
    },
  ],
  exports: [WarningExecutionService],
})
export class WarningExecutionModule {}
