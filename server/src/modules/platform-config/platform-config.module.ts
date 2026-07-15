import { Module } from '@nestjs/common';
import { InMemoryPlatformConfigRepository } from './in-memory-platform-config.repository';
import { PlatformConfigController } from './platform-config.controller';
import { PLATFORM_CONFIG_REPOSITORY } from './platform-config.repository';
import { PlatformConfigService } from './platform-config.service';
import { PrismaPlatformConfigRepository } from './prisma-platform-config.repository';

@Module({
  controllers: [PlatformConfigController],
  providers: [
    InMemoryPlatformConfigRepository,
    PrismaPlatformConfigRepository,
    {
      provide: PLATFORM_CONFIG_REPOSITORY,
      inject: [InMemoryPlatformConfigRepository, PrismaPlatformConfigRepository],
      useFactory: (
        memory: InMemoryPlatformConfigRepository,
        prisma: PrismaPlatformConfigRepository,
      ) => (process.env.QHSE_REPOSITORY === 'prisma' ? prisma : memory),
    },
    {
      provide: PlatformConfigService,
      inject: [PLATFORM_CONFIG_REPOSITORY],
      useFactory: (repository: InMemoryPlatformConfigRepository | PrismaPlatformConfigRepository) =>
        new PlatformConfigService(repository),
    },
  ],
  exports: [PlatformConfigService],
})
export class PlatformConfigModule {}
