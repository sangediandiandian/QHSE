import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  type EmergencyResourceRepository,
  ResourceNotFoundError,
  ResourceVersionConflictError,
} from './emergency-resource.repository';
import type {
  EmergencyResource,
  ResourceBatch,
  ResourceDispatch,
  ResourceInspection,
  ResourceMutation,
} from './emergency-resource.types';

type Record = Awaited<ReturnType<PrismaService['emergencyResourceInventory']['findFirstOrThrow']>>;
const json = (value: unknown) => value as Prisma.InputJsonValue;
const mapRecord = (record: Record): EmergencyResource => ({
  ...record,
  type: record.type as EmergencyResource['type'],
  quantity: `${record.totalQuantity} ${record.unit}`,
  status: record.status as EmergencyResource['status'],
  inspectionStatus: record.inspectionStatus as EmergencyResource['inspectionStatus'],
  batches: record.batches as unknown as ResourceBatch[],
  dispatches: record.dispatches as unknown as ResourceDispatch[],
  inspectionRecords: record.inspectionRecords as unknown as ResourceInspection[],
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

@Injectable()
export class PrismaEmergencyResourceRepository implements EmergencyResourceRepository {
  constructor(private readonly prisma: PrismaService) {}
  async findAll() {
    return (
      await this.prisma.emergencyResourceInventory.findMany({ orderBy: { code: 'asc' } })
    ).map(mapRecord);
  }
  async findById(id: string) {
    const item = await this.prisma.emergencyResourceInventory.findUnique({ where: { id } });
    return item ? mapRecord(item) : undefined;
  }
  async findByCode(code: string) {
    const item = await this.prisma.emergencyResourceInventory.findUnique({ where: { code } });
    return item ? mapRecord(item) : undefined;
  }
  async create(resource: EmergencyResource) {
    return mapRecord(
      await this.prisma.emergencyResourceInventory.create({
        data: {
          id: resource.id,
          code: resource.code,
          name: resource.name,
          type: resource.type,
          totalQuantity: resource.totalQuantity,
          availableQuantity: resource.availableQuantity,
          unit: resource.unit,
          location: resource.location,
          eta: resource.eta,
          status: resource.status,
          owner: resource.owner,
          contact: resource.contact,
          lastInspection: resource.lastInspection,
          nextInspection: resource.nextInspection,
          inspectionStatus: resource.inspectionStatus,
          batches: json(resource.batches),
          dispatches: json(resource.dispatches),
          inspectionRecords: json(resource.inspectionRecords),
          version: resource.version,
          createdAt: new Date(resource.createdAt),
          updatedAt: new Date(resource.updatedAt),
        },
      }),
    );
  }
  async mutate(id: string, mutation: ResourceMutation, expectedVersion: number) {
    const current = await this.findById(id);
    if (!current) throw new ResourceNotFoundError();
    if (current.version !== expectedVersion)
      throw new ResourceVersionConflictError(expectedVersion, current.version);
    const inspections = mutation.inspection
      ? [...current.inspectionRecords, mutation.inspection]
      : current.inspectionRecords;
    const updated = await this.prisma.emergencyResourceInventory.updateMany({
      where: { id, version: expectedVersion },
      data: {
        totalQuantity: mutation.totalQuantity,
        availableQuantity: mutation.availableQuantity,
        eta: mutation.eta,
        status: mutation.status,
        lastInspection: mutation.lastInspection,
        nextInspection: mutation.nextInspection,
        inspectionStatus: mutation.inspectionStatus,
        batches: mutation.batches ? json(mutation.batches) : undefined,
        dispatches: mutation.dispatches ? json(mutation.dispatches) : undefined,
        inspectionRecords: mutation.inspection ? json(inspections) : undefined,
        version: { increment: 1 },
        updatedAt: new Date(mutation.updatedAt),
      },
    });
    if (!updated.count)
      throw new ResourceVersionConflictError(expectedVersion, expectedVersion + 1);
    return this.findById(id) as Promise<EmergencyResource>;
  }
}
