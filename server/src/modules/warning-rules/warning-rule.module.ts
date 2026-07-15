import { Module } from '@nestjs/common';
import { WorkflowModule } from '../workflows/workflow.module';
import { WorkflowService } from '../workflows/workflow.service';
import { InMemoryWarningRuleRepository } from './in-memory-warning-rule.repository';
import { PrismaWarningRuleRepository } from './prisma-warning-rule.repository';
import { WarningRuleController } from './warning-rule.controller';
import { WARNING_RULE_REPOSITORY } from './warning-rule.repository';
import { WarningRuleService } from './warning-rule.service';

@Module({
  imports: [WorkflowModule],
  controllers: [WarningRuleController],
  providers: [
    InMemoryWarningRuleRepository,
    PrismaWarningRuleRepository,
    {
      provide: WARNING_RULE_REPOSITORY,
      inject: [InMemoryWarningRuleRepository, PrismaWarningRuleRepository],
      useFactory: (memory: InMemoryWarningRuleRepository, prisma: PrismaWarningRuleRepository) =>
        process.env.QHSE_REPOSITORY === 'prisma' ? prisma : memory,
    },
    {
      provide: WarningRuleService,
      inject: [WARNING_RULE_REPOSITORY, WorkflowService],
      useFactory: (
        repository: InMemoryWarningRuleRepository | PrismaWarningRuleRepository,
        workflow: WorkflowService,
      ) => new WarningRuleService(repository, workflow),
    },
  ],
  exports: [WarningRuleService],
})
export class WarningRuleModule {}
