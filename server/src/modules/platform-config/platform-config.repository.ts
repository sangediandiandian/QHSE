import type { IntegrationConfig, PlatformDictionary } from './platform-config.types';

export const PLATFORM_CONFIG_REPOSITORY = Symbol('PLATFORM_CONFIG_REPOSITORY');

export class PlatformConfigNotFoundError extends Error {}
export class PlatformConfigCodeConflictError extends Error {}
export class PlatformConfigVersionConflictError extends Error {
  constructor(
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
  ) {
    super('Platform config version conflict');
  }
}

export interface PlatformConfigRepository {
  listDictionaries(): Promise<PlatformDictionary[]>;
  findDictionary(id: string): Promise<PlatformDictionary | undefined>;
  createDictionary(value: PlatformDictionary): Promise<PlatformDictionary>;
  updateDictionary(value: PlatformDictionary, expectedVersion: number): Promise<PlatformDictionary>;
  listIntegrations(): Promise<IntegrationConfig[]>;
  findIntegration(id: string): Promise<IntegrationConfig | undefined>;
  createIntegration(value: IntegrationConfig): Promise<IntegrationConfig>;
  updateIntegration(value: IntegrationConfig, expectedVersion: number): Promise<IntegrationConfig>;
}
