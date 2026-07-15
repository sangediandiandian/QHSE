import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  CreateDictionaryDto,
  CreateIntegrationDto,
  UpdateDictionaryDto,
  UpdateIntegrationDto,
} from './platform-config.dto';
import {
  PlatformConfigCodeConflictError,
  PlatformConfigNotFoundError,
  type PlatformConfigRepository,
  PlatformConfigVersionConflictError,
} from './platform-config.repository';

export class PlatformConfigService {
  constructor(
    private readonly repository: PlatformConfigRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = randomUUID,
  ) {}

  listDictionaries() {
    return this.repository.listDictionaries();
  }

  listIntegrations() {
    return this.repository.listIntegrations();
  }

  async createDictionary(input: CreateDictionaryDto) {
    this.validateItems(input.items);
    const timestamp = this.now().toISOString();
    try {
      return await this.repository.createDictionary({
        id: this.createId(),
        code: input.code,
        name: input.name.trim(),
        description: input.description?.trim() || undefined,
        items: [...input.items]
          .map((item) => ({ ...item, value: item.value.trim(), label: item.label.trim() }))
          .sort((a, b) => a.sort - b.sort),
        status: input.status,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    } catch (error) {
      this.mapError(error);
    }
  }

  async updateDictionary(id: string, input: UpdateDictionaryDto) {
    this.validateItems(input.items);
    const current = await this.repository.findDictionary(id);
    if (!current) this.notFound();
    if (input.code !== current.code) {
      throw new BadRequestException({
        code: 'CONFIG_CODE_IMMUTABLE',
        message: '配置编码创建后不可修改',
      });
    }
    try {
      return await this.repository.updateDictionary(
        {
          ...current,
          name: input.name.trim(),
          description: input.description?.trim() || undefined,
          items: [...input.items]
            .map((item) => ({ ...item, value: item.value.trim(), label: item.label.trim() }))
            .sort((a, b) => a.sort - b.sort),
          status: input.status,
          version: current.version + 1,
          updatedAt: this.now().toISOString(),
        },
        input.expectedVersion,
      );
    } catch (error) {
      this.mapError(error);
    }
  }

  async createIntegration(input: CreateIntegrationDto) {
    this.validateEndpoint(input.endpoint, input.protocol);
    const timestamp = this.now().toISOString();
    try {
      return await this.repository.createIntegration({
        id: this.createId(),
        code: input.code,
        name: input.name.trim(),
        type: input.type,
        protocol: input.protocol,
        endpoint: input.endpoint.trim(),
        enabled: input.enabled,
        timeoutMs: input.timeoutMs,
        owner: input.owner.trim(),
        healthStatus: 'unchecked',
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    } catch (error) {
      this.mapError(error);
    }
  }

  async updateIntegration(id: string, input: UpdateIntegrationDto) {
    this.validateEndpoint(input.endpoint, input.protocol);
    const current = await this.repository.findIntegration(id);
    if (!current) this.notFound();
    if (input.code !== current.code) {
      throw new BadRequestException({
        code: 'CONFIG_CODE_IMMUTABLE',
        message: '配置编码创建后不可修改',
      });
    }
    try {
      return await this.repository.updateIntegration(
        {
          ...current,
          name: input.name.trim(),
          type: input.type,
          protocol: input.protocol,
          endpoint: input.endpoint.trim(),
          enabled: input.enabled,
          timeoutMs: input.timeoutMs,
          owner: input.owner.trim(),
          healthStatus: 'unchecked',
          lastCheckedAt: undefined,
          version: current.version + 1,
          updatedAt: this.now().toISOString(),
        },
        input.expectedVersion,
      );
    } catch (error) {
      this.mapError(error);
    }
  }

  private validateItems(items: CreateDictionaryDto['items']) {
    const values = items.map((item) => item.value.trim());
    if (values.some((value) => !value) || new Set(values).size !== values.length) {
      throw new BadRequestException({
        code: 'DICTIONARY_ITEM_DUPLICATE',
        message: '字典项值不能为空或重复',
      });
    }
  }

  private validateEndpoint(endpoint: string, protocol: CreateIntegrationDto['protocol']) {
    try {
      const url = new URL(endpoint);
      const expected = `${protocol.toLowerCase()}:`;
      if (url.protocol !== expected || url.username || url.password) throw new Error('invalid');
    } catch {
      throw new BadRequestException({
        code: 'INTEGRATION_ENDPOINT_INVALID',
        message: '接口地址协议不匹配，且地址中不得包含账号或密钥',
      });
    }
  }

  private notFound(): never {
    throw new NotFoundException({ code: 'PLATFORM_CONFIG_NOT_FOUND', message: '配置不存在' });
  }

  private mapError(error: unknown): never {
    if (error instanceof PlatformConfigNotFoundError) this.notFound();
    if (error instanceof PlatformConfigCodeConflictError) {
      throw new ConflictException({ code: 'CONFIG_CODE_EXISTS', message: '配置编码已存在' });
    }
    if (error instanceof PlatformConfigVersionConflictError) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: '配置已被其他用户更新，请刷新后重试',
        details: {
          expectedVersion: error.expectedVersion,
          actualVersion: error.actualVersion,
        },
      });
    }
    throw error;
  }
}
