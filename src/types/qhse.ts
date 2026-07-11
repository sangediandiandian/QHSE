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
  source: 'GDS' | 'VOC' | 'MES' | '联合预警' | '作业许可';
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

export type VocPointStatus = 'normal' | 'warning' | 'exceeded' | 'offline';

export interface VocPoint {
  id: string;
  code: string;
  name: string;
  pointType: '有组织排口' | '厂界监测点';
  areaId: string;
  areaName: string;
  pollutantType: '非甲烷总烃' | '苯系物';
  currentValue: number;
  limitValue: number;
  flowValue: number;
  facilityId?: string;
  status: VocPointStatus;
  trend: number[];
}

export interface VocFacility {
  id: string;
  code: string;
  name: string;
  processType: 'RTO' | 'RCO';
  areaName: string;
  inletValue: number;
  outletValue: number;
  efficiency: number;
  temperature: number;
  fanStatus: '运行' | '故障';
  valveStatus: '开启' | '关闭';
  status: 'normal' | 'degraded' | 'fault';
}

export type MesParameterType = '压力' | '温度' | '流量' | '液位' | '负荷';

export interface MesTag {
  id: string;
  code: string;
  name: string;
  unitId: string;
  unitName: string;
  equipmentName: string;
  processStep: '进料' | '加热' | '分馏' | '外送';
  parameterType: MesParameterType;
  currentValue: number;
  unit: string;
  upperLimit: number;
  lowerLimit: number;
  status: 'normal' | 'warning' | 'alarm' | 'offline';
  trend: number[];
}

export interface MesUnit {
  id: string;
  code: string;
  name: string;
  load: number;
  operatingMode: string;
  status: 'normal' | 'warning' | 'alarm';
}

export type CommunicationChannel = 'App消息' | '电话语音' | '短信' | 'IP广播';

export interface CommunicationTask {
  id: string;
  eventId: string;
  eventTitle: string;
  receiver: string;
  receiverRole: string;
  channel: CommunicationChannel;
  sendTime: string;
  deliveryStatus: '发送中' | '已送达' | '失败';
  confirmStatus: '待确认' | '未确认' | '已确认';
  confirmTime?: string;
  retryCount: number;
  escalationLevel: 0 | 1 | 2 | 3;
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
  vocPoints: VocPoint[];
  vocFacilities: VocFacility[];
  mesTags: MesTag[];
  mesUnits: MesUnit[];
  communicationTasks: CommunicationTask[];
}
