import { Module } from '@nestjs/common';
import { EmergencyResourceController } from './emergency-resource.controller';
import { EmergencyResourceService } from './emergency-resource.service';
import { EMERGENCY_RESOURCE_REPOSITORY } from './emergency-resource.repository';
import { InMemoryEmergencyResourceRepository } from './in-memory-emergency-resource.repository';
import { PrismaEmergencyResourceRepository } from './prisma-emergency-resource.repository';
@Module({
  controllers: [EmergencyResourceController],
  providers: [
    InMemoryEmergencyResourceRepository,
    PrismaEmergencyResourceRepository,
    {
      provide: EMERGENCY_RESOURCE_REPOSITORY,
      inject: [InMemoryEmergencyResourceRepository, PrismaEmergencyResourceRepository],
      useFactory: (
        memory: InMemoryEmergencyResourceRepository,
        prisma: PrismaEmergencyResourceRepository,
      ) => (process.env.QHSE_REPOSITORY === 'prisma' ? prisma : memory),
    },
    {
      provide: EmergencyResourceService,
      inject: [EMERGENCY_RESOURCE_REPOSITORY],
      useFactory: (repo: InMemoryEmergencyResourceRepository | PrismaEmergencyResourceRepository) =>
        new EmergencyResourceService(repo),
    },
  ],
  exports: [EmergencyResourceService],
})
export class EmergencyResourceModule {}
