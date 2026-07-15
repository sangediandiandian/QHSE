import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { AUDIT_REPOSITORY } from './audit.repository';
import { AuditService } from './audit.service';
import { InMemoryAuditRepository } from './in-memory-audit.repository';
import { PrismaAuditRepository } from './prisma-audit.repository';

@Module({
  controllers: [AuditController],
  providers: [
    InMemoryAuditRepository,
    PrismaAuditRepository,
    {
      provide: AUDIT_REPOSITORY,
      inject: [InMemoryAuditRepository, PrismaAuditRepository],
      useFactory: (memory: InMemoryAuditRepository, prisma: PrismaAuditRepository) => (
        process.env.QHSE_REPOSITORY === 'prisma' ? prisma : memory
      ),
    },
    {
      provide: AuditService,
      inject: [AUDIT_REPOSITORY],
      useFactory: (repository: InMemoryAuditRepository | PrismaAuditRepository) => (
        new AuditService(repository)
      ),
    },
    AuditInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
