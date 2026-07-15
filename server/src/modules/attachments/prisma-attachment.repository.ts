import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { AttachmentRepository } from './attachment.repository';
import type { AttachmentBinding, StoredObject } from './attachment.types';

type StoredObjectRecord = Awaited<ReturnType<PrismaService['storedObject']['findFirstOrThrow']>>;

const map = (record: StoredObjectRecord): StoredObject => ({
  ...record,
  provider: record.provider as StoredObject['provider'],
  bucket: record.bucket ?? undefined,
  businessType: record.businessType as StoredObject['businessType'],
  businessId: record.businessId ?? undefined,
  status: record.status as StoredObject['status'],
  createdAt: record.createdAt.toISOString(),
  boundAt: record.boundAt?.toISOString(),
});

@Injectable()
export class PrismaAttachmentRepository implements AttachmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(object: StoredObject) {
    return map(
      await this.prisma.storedObject.create({
        data: {
          id: object.id,
          storageKey: object.storageKey,
          provider: object.provider,
          bucket: object.bucket,
          originalName: object.originalName,
          contentType: object.contentType,
          size: object.size,
          sha256: object.sha256,
          uploaderId: object.uploaderId,
          uploader: object.uploader,
          areaId: object.areaId,
          businessType: object.businessType,
          businessId: object.businessId,
          status: object.status,
          createdAt: new Date(object.createdAt),
          boundAt: object.boundAt ? new Date(object.boundAt) : undefined,
        },
      }),
    );
  }

  async findById(id: string) {
    const object = await this.prisma.storedObject.findUnique({ where: { id } });
    return object ? map(object) : undefined;
  }

  async bind(id: string, binding: AttachmentBinding) {
    const result = await this.prisma.storedObject.updateMany({
      where: { id, status: 'uploaded' },
      data: {
        status: 'bound',
        businessType: binding.businessType,
        businessId: binding.businessId,
        areaId: binding.areaId,
        boundAt: new Date(binding.boundAt),
      },
    });
    if (!result.count) return undefined;
    return map(await this.prisma.storedObject.findUniqueOrThrow({ where: { id } }));
  }
}
