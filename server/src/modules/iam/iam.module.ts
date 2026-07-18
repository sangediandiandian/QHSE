import { Module } from '@nestjs/common';
import { InMemoryIamRepository } from './in-memory-iam.repository';
import { IamChangeBusService } from './iam-change-bus.service';
import { MemoryIamChangeTransport } from './iam-change.transport';
import { IamController } from './iam.controller';
import { IamService } from './iam.service';
import { PrismaIamRepository } from './prisma-iam.repository';
import { RedisIamChangeTransport } from './redis-iam-change.transport';

@Module({
  controllers: [IamController],
  providers: [
    InMemoryIamRepository,
    PrismaIamRepository,
    {
      provide: IamChangeBusService,
      useFactory: () => {
        if (process.env.QHSE_IAM_EVENTS !== 'redis') {
          return new IamChangeBusService(new MemoryIamChangeTransport());
        }
        if (process.env.QHSE_REPOSITORY !== 'prisma') {
          throw new Error('QHSE_IAM_EVENTS=redis requires QHSE_REPOSITORY=prisma');
        }
        const url = process.env.QHSE_IAM_REDIS_URL || process.env.QHSE_REDIS_URL;
        if (!url) {
          throw new Error('QHSE_IAM_EVENTS=redis requires QHSE_IAM_REDIS_URL or QHSE_REDIS_URL');
        }
        let service!: IamChangeBusService;
        const transport = new RedisIamChangeTransport(url, () => service.recordTransportError());
        service = new IamChangeBusService(transport);
        return service;
      },
    },
    {
      provide: IamService,
      inject: [InMemoryIamRepository, PrismaIamRepository, IamChangeBusService],
      useFactory: (
        memory: InMemoryIamRepository,
        prisma: PrismaIamRepository,
        changes: IamChangeBusService,
      ) =>
        new IamService(
          process.env.QHSE_REPOSITORY === 'prisma' ? prisma : memory,
          undefined,
          undefined,
          changes,
        ),
    },
  ],
  exports: [IamService, IamChangeBusService],
})
export class IamModule {}
