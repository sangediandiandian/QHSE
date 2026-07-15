import { Module } from '@nestjs/common';
import { RiskModule } from '../risks/risk.module';
import { HazardController } from './hazard.controller';
import { InMemoryHazardRepository } from './in-memory-hazard.repository';
import { PrismaHazardRepository } from './prisma-hazard.repository';
import { HAZARD_REPOSITORY } from './hazard.repository';
import { HazardService } from './hazard.service';
import { RiskService } from '../risks/risk.service';

@Module({
  imports: [RiskModule],
  controllers: [HazardController],
  providers: [
    InMemoryHazardRepository,
    PrismaHazardRepository,
    {
      provide: HAZARD_REPOSITORY,
      inject: [InMemoryHazardRepository, PrismaHazardRepository],
      useFactory: (memory: InMemoryHazardRepository, prisma: PrismaHazardRepository) =>
        process.env.QHSE_REPOSITORY === 'prisma' ? prisma : memory,
    },
    {
      provide: HazardService,
      inject: [HAZARD_REPOSITORY, RiskService],
      useFactory: (
        repository: InMemoryHazardRepository | PrismaHazardRepository,
        riskService: RiskService,
      ) => new HazardService(repository, riskService),
    },
  ],
})
export class HazardModule {}
