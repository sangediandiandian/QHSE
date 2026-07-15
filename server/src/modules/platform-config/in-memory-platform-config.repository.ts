import { Injectable } from '@nestjs/common';
import {
  PlatformConfigCodeConflictError,
  PlatformConfigNotFoundError,
  type PlatformConfigRepository,
  PlatformConfigVersionConflictError,
} from './platform-config.repository';
import { dictionarySeed, integrationConfigSeed } from './platform-config.seed';
import type { IntegrationConfig, PlatformDictionary } from './platform-config.types';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

@Injectable()
export class InMemoryPlatformConfigRepository implements PlatformConfigRepository {
  private readonly dictionaries = new Map(dictionarySeed.map((item) => [item.id, clone(item)]));
  private readonly integrations = new Map(
    integrationConfigSeed.map((item) => [item.id, clone(item)]),
  );

  async listDictionaries() {
    return clone([...this.dictionaries.values()].sort((a, b) => a.code.localeCompare(b.code)));
  }

  async findDictionary(id: string) {
    const value = this.dictionaries.get(id);
    return value ? clone(value) : undefined;
  }

  async createDictionary(value: PlatformDictionary) {
    if ([...this.dictionaries.values()].some((item) => item.code === value.code)) {
      throw new PlatformConfigCodeConflictError();
    }
    this.dictionaries.set(value.id, clone(value));
    return clone(value);
  }

  async updateDictionary(value: PlatformDictionary, expectedVersion: number) {
    const current = this.dictionaries.get(value.id);
    if (!current) throw new PlatformConfigNotFoundError();
    if (current.version !== expectedVersion) {
      throw new PlatformConfigVersionConflictError(expectedVersion, current.version);
    }
    this.dictionaries.set(value.id, clone(value));
    return clone(value);
  }

  async listIntegrations() {
    return clone([...this.integrations.values()].sort((a, b) => a.code.localeCompare(b.code)));
  }

  async findIntegration(id: string) {
    const value = this.integrations.get(id);
    return value ? clone(value) : undefined;
  }

  async createIntegration(value: IntegrationConfig) {
    if ([...this.integrations.values()].some((item) => item.code === value.code)) {
      throw new PlatformConfigCodeConflictError();
    }
    this.integrations.set(value.id, clone(value));
    return clone(value);
  }

  async updateIntegration(value: IntegrationConfig, expectedVersion: number) {
    const current = this.integrations.get(value.id);
    if (!current) throw new PlatformConfigNotFoundError();
    if (current.version !== expectedVersion) {
      throw new PlatformConfigVersionConflictError(expectedVersion, current.version);
    }
    this.integrations.set(value.id, clone(value));
    return clone(value);
  }
}
