import { Module } from '@nestjs/common';
import { InMemoryWorkPermitRepository } from './in-memory-work-permit.repository';
import { PrismaWorkPermitRepository } from './prisma-work-permit.repository';
import { WORK_PERMIT_REPOSITORY } from './work-permit.repository';
import { WorkPermitController } from './work-permit.controller';
import { WorkPermitService } from './work-permit.service';

@Module({
  controllers: [WorkPermitController],
  providers: [
    InMemoryWorkPermitRepository,
    PrismaWorkPermitRepository,
    {
      provide: WORK_PERMIT_REPOSITORY,
      inject: [InMemoryWorkPermitRepository, PrismaWorkPermitRepository],
      useFactory: (memory: InMemoryWorkPermitRepository, prisma: PrismaWorkPermitRepository) =>
        process.env.QHSE_REPOSITORY === 'prisma' ? prisma : memory,
    },
    {
      provide: WorkPermitService,
      inject: [WORK_PERMIT_REPOSITORY],
      useFactory: (repository: InMemoryWorkPermitRepository | PrismaWorkPermitRepository) =>
        new WorkPermitService(repository),
    },
  ],
  exports: [WorkPermitService],
})
export class WorkPermitModule {}
