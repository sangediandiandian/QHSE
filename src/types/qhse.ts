export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type AreaStatus = 'normal' | 'warning' | 'alarm';

export interface PlantArea {
  id: string;
  code: string;
  name: string;
  shortName: string;
  riskLevel: RiskLevel;
  status: AreaStatus;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AlarmEvent {
  id: string;
  code: string;
  title: string;
  source: 'GDS' | 'VOC' | 'MES' | '作业许可';
  areaId: string;
  areaName: string;
  level: RiskLevel;
  value: string;
  occurredAt: string;
  status: '待确认' | '处置中' | '监控中';
}

export interface TrendPoint {
  label: string;
  gds: number;
  voc: number;
  mes: number;
}

export interface DashboardMetrics {
  overallRisk: '低风险' | '一般风险' | '较大风险' | '重大风险';
  onlineUnits: number;
  gdsOnlineRate: number;
  activeAlarms: number;
  vocComplianceRate: number;
  mesAnomalies: number;
  pendingWarnings: number;
  highRiskPermits: number;
  deliveryRate: number;
}

export interface DashboardData {
  updatedAt: string;
  metrics: DashboardMetrics;
  areas: PlantArea[];
  alarms: AlarmEvent[];
  trend: TrendPoint[];
}
