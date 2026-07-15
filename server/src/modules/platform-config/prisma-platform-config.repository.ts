import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  PlatformConfigCodeConflictError,
  PlatformConfigNotFoundError,
  type PlatformConfigRepository,
  PlatformConfigVersionConflictError,
} from './platform-config.repository';
import type {
  DictionaryItem,
  IntegrationConfig,
  PlatformDictionary,
} from './platform-config.types';

type DictionaryRecord = Awaited<
  ReturnType<PrismaService['platformDictionary']['findFirstOrThrow']>
>;
type IntegrationRecord = Awaited<
  ReturnType<PrismaService['integrationConfig']['findFirstOrThrow']>
>;

const mapDictionary = (record: DictionaryRecord): PlatformDictionary => ({
  ...record,
  description: record.description ?? undefined,
  items: record.items as unknown as DictionaryItem[],
  status: record.status as PlatformDictionary['status'],
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

const mapIntegration = (record: IntegrationRecord): IntegrationConfig => ({
  ...record,
  type: record.type as IntegrationConfig['type'],
  protocol: record.protocol as IntegrationConfig['protocol'],
  healthStatus: record.healthStatus as IntegrationConfig['healthStatus'],
  lastCheckedAt: record.lastCheckedAt?.toISOString(),
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

const dictionaryData = (value: PlatformDictionary) => ({
  id: value.id,
  code: value.code,
  name: value.name,
  description: value.description,
  items: value.items as unknown as Prisma.InputJsonValue,
  status: value.status,
  version: value.version,
  createdAt: new Date(value.createdAt),
  updatedAt: new Date(value.updatedAt),
});

const integrationData = (value: IntegrationConfig) => ({
  id: value.id,
  code: value.code,
  name: value.name,
  type: value.type,
  protocol: value.protocol,
  endpoint: value.endpoint,
  enabled: value.enabled,
  timeoutMs: value.timeoutMs,
  owner: value.owner,
  healthStatus: value.healthStatus,
  lastCheckedAt: value.lastCheckedAt ? new Date(value.lastCheckedAt) : undefined,
  version: value.version,
  createdAt: new Date(value.createdAt),
  updatedAt: new Date(value.updatedAt),
});

@Injectable()
export class PrismaPlatformConfigRepository implements PlatformConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listDictionaries() {
    return (await this.prisma.platformDictionary.findMany({ orderBy: { code: 'asc' } })).map(
      mapDictionary,
    );
  }

  async findDictionary(id: string) {
    const value = await this.prisma.platformDictionary.findUnique({ where: { id } });
    return value ? mapDictionary(value) : undefined;
  }

  async createDictionary(value: PlatformDictionary) {
    try {
      return mapDictionary(
        await this.prisma.platformDictionary.create({ data: dictionaryData(value) }),
      );
    } catch (error) {
      this.mapCreateError(error);
    }
  }

  async updateDictionary(value: PlatformDictionary, expectedVersion: number) {
    const result = await this.prisma.platformDictionary.updateMany({
      where: { id: value.id, version: expectedVersion },
      data: {
        name: value.name,
        description: value.description,
        items: value.items as unknown as Prisma.InputJsonValue,
        status: value.status,
        version: { increment: 1 },
        updatedAt: new Date(value.updatedAt),
      },
    });
    if (!result.count) await this.throwMutationError(value.id, expectedVersion, 'dictionary');
    return mapDictionary(
      await this.prisma.platformDictionary.findUniqueOrThrow({ where: { id: value.id } }),
    );
  }

  async listIntegrations() {
    return (await this.prisma.integrationConfig.findMany({ orderBy: { code: 'asc' } })).map(
      mapIntegration,
    );
  }

  async findIntegration(id: string) {
    const value = await this.prisma.integrationConfig.findUnique({ where: { id } });
    return value ? mapIntegration(value) : undefined;
  }

  async createIntegration(value: IntegrationConfig) {
    try {
      return mapIntegration(
        await this.prisma.integrationConfig.create({ data: integrationData(value) }),
      );
    } catch (error) {
      this.mapCreateError(error);
    }
  }

  async updateIntegration(value: IntegrationConfig, expectedVersion: number) {
    const result = await this.prisma.integrationConfig.updateMany({
      where: { id: value.id, version: expectedVersion },
      data: {
        name: value.name,
        type: value.type,
        protocol: value.protocol,
        endpoint: value.endpoint,
        enabled: value.enabled,
        timeoutMs: value.timeoutMs,
        owner: value.owner,
        healthStatus: value.healthStatus,
        lastCheckedAt: value.lastCheckedAt ? new Date(value.lastCheckedAt) : null,
        version: { increment: 1 },
        updatedAt: new Date(value.updatedAt),
      },
    });
    if (!result.count) await this.throwMutationError(value.id, expectedVersion, 'integration');
    return mapIntegration(
      await this.prisma.integrationConfig.findUniqueOrThrow({ where: { id: value.id } }),
    );
  }

  private mapCreateError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new PlatformConfigCodeConflictError();
    }
    throw error;
  }

  private async throwMutationError(
    id: string,
    expectedVersion: number,
    type: 'dictionary' | 'integration',
  ): Promise<never> {
    const current =
      type === 'dictionary'
        ? await this.prisma.platformDictionary.findUnique({ where: { id } })
        : await this.prisma.integrationConfig.findUnique({ where: { id } });
    if (!current) throw new PlatformConfigNotFoundError();
    throw new PlatformConfigVersionConflictError(expectedVersion, current.version);
  }
}
