export interface DictionaryItem {
  value: string;
  label: string;
  sort: number;
  enabled: boolean;
  color?: string;
}

export interface PlatformDictionary {
  id: string;
  code: string;
  name: string;
  description?: string;
  items: DictionaryItem[];
  status: 'enabled' | 'disabled';
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type IntegrationType = 'telemetry' | 'communication' | 'identity' | 'storage';
export type IntegrationHealth = 'unchecked' | 'connected' | 'degraded' | 'disconnected';

export interface IntegrationConfig {
  id: string;
  code: string;
  name: string;
  type: IntegrationType;
  protocol: 'HTTP' | 'HTTPS' | 'MQTT' | 'MQTTS';
  endpoint: string;
  enabled: boolean;
  timeoutMs: number;
  owner: string;
  healthStatus: IntegrationHealth;
  lastCheckedAt?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
