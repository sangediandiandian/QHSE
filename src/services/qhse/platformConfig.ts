import type { IntegrationConfig, PlatformDictionary } from '@/types/qhse';
import { request } from '@umijs/max';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  requestId: string;
  timestamp: string;
}

export type DictionaryInput = Pick<
  PlatformDictionary,
  'code' | 'name' | 'description' | 'items' | 'status'
>;
export type IntegrationInput = Pick<
  IntegrationConfig,
  'code' | 'name' | 'type' | 'protocol' | 'endpoint' | 'enabled' | 'timeoutMs' | 'owner'
>;

export async function getDictionaries() {
  const response = await request<ApiResponse<PlatformDictionary[]>>(
    '/api/v1/platform-config/dictionaries',
    { method: 'GET' },
  );
  return response.data;
}

export async function saveDictionary(input: DictionaryInput, current?: PlatformDictionary) {
  const response = await request<ApiResponse<PlatformDictionary>>(
    current
      ? `/api/v1/platform-config/dictionaries/${current.id}`
      : '/api/v1/platform-config/dictionaries',
    {
      method: current ? 'PUT' : 'POST',
      data: current ? { ...input, expectedVersion: current.version } : input,
    },
  );
  return response.data;
}

export async function getIntegrationConfigs() {
  const response = await request<ApiResponse<IntegrationConfig[]>>(
    '/api/v1/platform-config/integrations',
    { method: 'GET' },
  );
  return response.data;
}

export async function saveIntegration(input: IntegrationInput, current?: IntegrationConfig) {
  const response = await request<ApiResponse<IntegrationConfig>>(
    current
      ? `/api/v1/platform-config/integrations/${current.id}`
      : '/api/v1/platform-config/integrations',
    {
      method: current ? 'PUT' : 'POST',
      data: current ? { ...input, expectedVersion: current.version } : input,
    },
  );
  return response.data;
}
