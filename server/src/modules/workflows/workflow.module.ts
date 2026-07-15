import { Module } from '@nestjs/common';
import { InMemoryWorkflowRepository } from './in-memory-workflow.repository';
import { PrismaWorkflowRepository } from './prisma-workflow.repository';
import { WORKFLOW_REPOSITORY } from './workflow.repository';
import { WorkflowService } from './workflow.service';

@Module({
  providers: [
    InMemoryWorkflowRepository,
    PrismaWorkflowRepository,
    {
      provide: WORKFLOW_REPOSITORY,
      inject: [InMemoryWorkflowRepository, PrismaWorkflowRepository],
      useFactory: (memory: InMemoryWorkflowRepository, prisma: PrismaWorkflowRepository) =>
        process.env.QHSE_REPOSITORY === 'prisma' ? prisma : memory,
    },
    {
      provide: WorkflowService,
      inject: [WORKFLOW_REPOSITORY],
      useFactory: (repository: InMemoryWorkflowRepository | PrismaWorkflowRepository) =>
        new WorkflowService(repository),
    },
  ],
  exports: [WorkflowService],
})
export class WorkflowModule {}
