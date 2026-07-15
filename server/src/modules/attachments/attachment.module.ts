import { Module } from '@nestjs/common';
import { AttachmentController } from './attachment.controller';
import { ATTACHMENT_REPOSITORY } from './attachment.repository';
import { AttachmentService } from './attachment.service';
import { InMemoryAttachmentRepository } from './in-memory-attachment.repository';
import { LocalObjectStorage } from './local-object-storage';
import { OBJECT_STORAGE } from './object-storage';
import { PrismaAttachmentRepository } from './prisma-attachment.repository';
import { S3ObjectStorage } from './s3-object-storage';

@Module({
  controllers: [AttachmentController],
  providers: [
    InMemoryAttachmentRepository,
    PrismaAttachmentRepository,
    {
      provide: ATTACHMENT_REPOSITORY,
      inject: [InMemoryAttachmentRepository, PrismaAttachmentRepository],
      useFactory: (memory: InMemoryAttachmentRepository, prisma: PrismaAttachmentRepository) =>
        process.env.QHSE_REPOSITORY === 'prisma' ? prisma : memory,
    },
    {
      provide: OBJECT_STORAGE,
      useFactory: () =>
        process.env.QHSE_OBJECT_STORAGE === 's3' ? new S3ObjectStorage() : new LocalObjectStorage(),
    },
    {
      provide: AttachmentService,
      inject: [ATTACHMENT_REPOSITORY, OBJECT_STORAGE],
      useFactory: (
        repository: InMemoryAttachmentRepository | PrismaAttachmentRepository,
        storage: LocalObjectStorage | S3ObjectStorage,
      ) => new AttachmentService(repository, storage),
    },
  ],
  exports: [AttachmentService],
})
export class AttachmentModule {}
