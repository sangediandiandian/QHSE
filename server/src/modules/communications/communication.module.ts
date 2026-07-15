import { Module } from '@nestjs/common';
import { CommunicationController } from './communication.controller';
import { COMMUNICATION_REPOSITORY } from './communication.repository';
import { CommunicationService } from './communication.service';
import { InMemoryCommunicationRepository } from './in-memory-communication.repository';
import { PrismaCommunicationRepository } from './prisma-communication.repository';
@Module({
  controllers: [CommunicationController],
  providers: [
    InMemoryCommunicationRepository,
    PrismaCommunicationRepository,
    {
      provide: COMMUNICATION_REPOSITORY,
      inject: [InMemoryCommunicationRepository, PrismaCommunicationRepository],
      useFactory: (
        memory: InMemoryCommunicationRepository,
        prisma: PrismaCommunicationRepository,
      ) => (process.env.QHSE_REPOSITORY === 'prisma' ? prisma : memory),
    },
    {
      provide: CommunicationService,
      inject: [COMMUNICATION_REPOSITORY],
      useFactory: (repo: InMemoryCommunicationRepository | PrismaCommunicationRepository) =>
        new CommunicationService(repo),
    },
  ],
  exports: [CommunicationService],
})
export class CommunicationModule {}
