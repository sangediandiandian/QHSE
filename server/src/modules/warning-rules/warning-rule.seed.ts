import type { WarningRule, WarningRuleConfig } from './warning-rule.types';

const timestamp = '2026-07-01T01:00:00.000Z';
const configs: Array<{
  id: string;
  code: string;
  enabled: boolean;
  triggerCount: number;
  lastTriggeredAt?: string;
  config: WarningRuleConfig;
}> = [
  {
    id: 'rule-001',
    code: 'GDS_L2_01',
    enabled: true,
    triggerCount: 12,
    lastTriggeredAt: '2026-07-11T00:28:42.000Z',
    config: {
      name: '可燃气体二级报警',
      source: 'GDS',
      scenario: 'gds-level2',
      level: 'critical',
      scope: '全厂 GDS 可燃气体测点',
      condition: '测量值 ≥ 二级报警阈值',
      duration: '即时触发',
      notifyTargets: ['岗位操作员', '当班班长', '生产调度'],
      description: '单点达到二级阈值后生成重大预警并启动逐级通知。',
      expression: [
        { metric: 'GDS.currentValue', operator: '>=', threshold: '50', connector: 'AND' },
      ],
      rolloutPercentage: 100,
    },
  },
  {
    id: 'rule-002',
    code: 'VOC_OVER_10M',
    enabled: true,
    triggerCount: 4,
    lastTriggeredAt: '2026-07-10T06:36:20.000Z',
    config: {
      name: 'VOC 连续超限',
      source: 'VOC',
      scenario: 'voc-overlimit',
      level: 'high',
      scope: '有组织排口',
      condition: '排口浓度 > 排放限值',
      duration: '连续 10 分钟',
      notifyTargets: ['环保管理人员', '装置负责人', '生产调度'],
      description: '连续超限时同步检查治理设施效率和装置负荷。',
      expression: [
        { metric: 'VOC.outletValue', operator: '>', threshold: 'limit', connector: 'AND' },
      ],
      rolloutPercentage: 100,
    },
  },
  {
    id: 'rule-003',
    code: 'GDS_MES_01',
    enabled: true,
    triggerCount: 3,
    lastTriggeredAt: '2026-07-08T11:12:06.000Z',
    config: {
      name: '工艺介质泄漏联合研判',
      source: '联合预警',
      scenario: 'joint-leak',
      level: 'critical',
      scope: '装置泵区 50 米范围',
      condition: 'GDS 浓度上升 + 压力升高或流量下降',
      duration: '时间窗口 ≤ 5 分钟',
      notifyTargets: ['岗位操作员', '装置负责人', '生产调度', 'QHSE 值班'],
      description: '多源信号同时成立时提升为重大联合预警。',
      expression: [
        { metric: 'GDS.trend', operator: '=', threshold: 'up', connector: 'AND' },
        { metric: 'MES.pressure', operator: '>', threshold: 'high', connector: 'AND' },
      ],
      rolloutPercentage: 100,
    },
  },
  {
    id: 'rule-004',
    code: 'GDS_TREND_05',
    enabled: true,
    triggerCount: 27,
    lastTriggeredAt: '2026-07-13T23:42:10.000Z',
    config: {
      name: '可燃气体持续上升趋势',
      source: 'GDS',
      scenario: 'gds-trend',
      level: 'medium',
      scope: '全厂 GDS 可燃气体测点',
      condition: '连续 5 个采样点单调上升且当前值 ≥ 15%LEL',
      duration: '连续 5 分钟',
      notifyTargets: ['岗位操作员'],
      description: '在达到正式阈值前发出趋势提醒，提前开展现场确认。',
      expression: [
        { metric: 'GDS.currentValue', operator: '>=', threshold: '15', connector: 'AND' },
      ],
      rolloutPercentage: 100,
    },
  },
  {
    id: 'rule-005',
    code: 'PERMIT_ALARM_01',
    enabled: true,
    triggerCount: 8,
    lastTriggeredAt: '2026-07-11T00:28:45.000Z',
    config: {
      name: '高风险作业告警联动',
      source: '作业许可',
      scenario: 'permit-linkage',
      level: 'high',
      scope: '告警区域内在办作业票',
      condition: '较大及以上告警 + 同区域作业中票证',
      duration: '即时触发',
      notifyTargets: ['作业负责人', '现场监护人', '属地负责人'],
      description: '命中后生成暂停建议，由现场负责人确认并组织复测。',
      expression: [
        { metric: 'alarm.level', operator: '>=', threshold: 'high', connector: 'AND' },
        { metric: 'permit.status', operator: '=', threshold: '作业中', connector: 'AND' },
      ],
      rolloutPercentage: 100,
    },
  },
  {
    id: 'rule-006',
    code: 'MES_PRESSURE_02',
    enabled: false,
    triggerCount: 6,
    lastTriggeredAt: '2026-07-05T03:09:32.000Z',
    config: {
      name: '关键机泵出口压力偏高',
      source: 'MES',
      scenario: 'joint-leak',
      level: 'medium',
      scope: '关键机泵压力测点',
      condition: '压力 ≥ 高限值且持续波动',
      duration: '连续 3 分钟',
      notifyTargets: ['岗位操作员', '生产调度'],
      description: '单一工艺异常提醒；停用期间由联合规则继续监测。',
      expression: [{ metric: 'MES.pressure', operator: '>=', threshold: 'high', connector: 'AND' }],
      rolloutPercentage: 100,
    },
  },
];

export const warningRuleSeed: WarningRule[] = configs.map(
  ({ id, code, enabled, triggerCount, lastTriggeredAt, config }) => ({
    id,
    code,
    ...config,
    enabled,
    triggerCount,
    lastTriggeredAt,
    publishStatus: '已发布',
    version: 1,
    revision: 1,
    versions: [
      {
        id: `${id}-version-1`,
        ...config,
        version: 1,
        publishedAt: timestamp,
        publisherId: 'user-qhse',
        publisher: '赵磊',
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  }),
);
