import { Module } from '@nestjs/common';
import { InMemoryRiskRepository } from './in-memory-risk.repository';
import { PrismaRiskRepository } from './prisma-risk.repository';
import { RiskController } from './risk.controller';
import { RISK_REPOSITORY } from './risk.repository';
import { RiskService } from './risk.service';

@Module({
  controllers: [RiskController],
  providers: [
    InMemoryRiskRepository,
    PrismaRiskRepository,
    {
      provide: RISK_REPOSITORY,
      inject: [InMemoryRiskRepository, PrismaRiskRepository],
      useFactory: (memory: InMemoryRiskRepository, prisma: PrismaRiskRepository) => (
        process.env.QHSE_REPOSITORY === 'prisma' ? prisma : memory
      ),
    },
    {
      provide: RiskService,
      inject: [RISK_REPOSITORY],
      useFactory: (repository: InMemoryRiskRepository | PrismaRiskRepository) => (
        new RiskService(repository)
      ),
    },
  ],
  exports: [RiskService],
})
export class RiskModule {}
