import { Module } from '@nestjs/common';
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
  imports: [WarningRuleModule, WorkPermitModule],
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
      inject: [WARNING_EXECUTION_REPOSITORY, WarningRuleService, WorkPermitService],
      useFactory: (
        repository: InMemoryWarningExecutionRepository | PrismaWarningExecutionRepository,
        rules: WarningRuleService,
        permits: WorkPermitService,
      ) => new WarningExecutionService(repository, rules, permits),
    },
  ],
})
export class WarningExecutionModule {}
