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
  status: '待确认' | '已确认' | '处置中' | '监控中';
}

export type GdsAlarmStatus = 'normal' | 'level1' | 'level2' | 'trend';
export type DeviceOnlineStatus = 'online' | 'offline' | 'fault';

export interface GdsPoint {
  id: string;
  code: string;
  name: string;
  areaId: string;
  areaName: string;
  equipmentName: string;
  gasType: '可燃气体' | '硫化氢' | '氧气';
  currentValue: number;
  unit: '%LEL' | 'ppm' | '%VOL';
  alarmLevel1: number;
  alarmLevel2: number;
  onlineStatus: DeviceOnlineStatus;
  alarmStatus: GdsAlarmStatus;
  trend: number[];
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
  gdsPoints: GdsPoint[];
}
