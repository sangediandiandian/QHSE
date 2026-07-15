import type { IntegrationConfig, PlatformDictionary } from './platform-config.types';

const timestamp = '2026-07-15T00:00:00.000Z';

export const dictionarySeed: PlatformDictionary[] = [
  {
    id: 'dict-hazard-category',
    code: 'hazard_category',
    name: '隐患类别',
    description: '隐患上报和统计使用的标准分类',
    items: [
      { value: 'equipment', label: '设备设施', sort: 10, enabled: true },
      { value: 'operation', label: '作业活动', sort: 20, enabled: true },
      { value: 'environment', label: '作业环境', sort: 30, enabled: true },
      { value: 'management', label: '管理缺陷', sort: 40, enabled: true },
    ],
    status: 'enabled',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 'dict-warning-level',
    code: 'warning_level',
    name: '预警等级',
    description: '平台统一预警颜色和展示顺序',
    items: [
      { value: 'low', label: '一般', sort: 10, enabled: true, color: '#1677ff' },
      { value: 'medium', label: '较大', sort: 20, enabled: true, color: '#faad14' },
      { value: 'high', label: '重大', sort: 30, enabled: true, color: '#fa541c' },
      { value: 'critical', label: '特别重大', sort: 40, enabled: true, color: '#cf1322' },
    ],
    status: 'enabled',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];

export const integrationConfigSeed: IntegrationConfig[] = [
  {
    id: 'integration-gds',
    code: 'gds_gateway',
    name: 'GDS 数据网关',
    type: 'telemetry',
    protocol: 'MQTTS',
    endpoint: 'mqtts://gds.example.internal:8883',
    enabled: false,
    timeoutMs: 5000,
    owner: '仪表与自动化班组',
    healthStatus: 'unchecked',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 'integration-sms',
    code: 'sms_gateway',
    name: '短信通知网关',
    type: 'communication',
    protocol: 'HTTPS',
    endpoint: 'https://sms.example.internal/api',
    enabled: false,
    timeoutMs: 8000,
    owner: '信息中心',
    healthStatus: 'unchecked',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];
