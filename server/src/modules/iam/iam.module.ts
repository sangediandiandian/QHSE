import { Module } from '@nestjs/common';
import { InMemoryIamRepository } from './in-memory-iam.repository';
import { IamController } from './iam.controller';
import { IamService } from './iam.service';
import { PrismaIamRepository } from './prisma-iam.repository';

@Module({
  controllers: [IamController],
  providers: [
    InMemoryIamRepository,
    PrismaIamRepository,
    {
      provide: IamService,
      inject: [InMemoryIamRepository, PrismaIamRepository],
      useFactory: (memory: InMemoryIamRepository, prisma: PrismaIamRepository) =>
        new IamService(process.env.QHSE_REPOSITORY === 'prisma' ? prisma : memory),
    },
  ],
  exports: [IamService],
})
export class IamModule {}
