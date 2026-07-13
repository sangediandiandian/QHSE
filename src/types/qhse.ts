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

export type EmergencyTaskStatus = '待执行' | '执行中' | '已完成';

export interface EmergencyTask {
  id: string;
  eventId: string;
  name: string;
  department: string;
  owner: string;
  deadline: string;
  status: EmergencyTaskStatus;
  feedback?: string;
}

export interface EmergencyResource {
  id: string;
  code: string;
  name: string;
  type: '消防' | '气防' | '医疗' | '物资';
  quantity: string;
  location: string;
  eta: string;
  status: '待命' | '调度中' | '已到位';
  owner: string;
  contact: string;
  lastInspection: string;
  inspectionStatus: '检查合格' | '即将到期' | '需要维护';
}

export interface EmergencyPlan {
  id: string;
  code: string;
  name: string;
  eventId: string;
  responseLevel: 'IV级' | 'III级' | 'II级' | 'I级';
  matchScore: number;
  matchReason: string;
  commander: string;
  assemblyPoint: string;
  status: '推荐' | '已启动' | '已终止';
}

export interface EmergencyPlanTemplate {
  id: string;
  code: string;
  name: string;
  category: '综合应急预案' | '专项应急预案' | '现场处置方案' | '岗位应急处置卡';
  eventType: string;
  applicableArea: string;
  medium: string;
  responseLevel: 'IV级' | 'III级' | 'II级' | 'I级';
  triggerRule: string;
  notificationTargets: string[];
  steps: string[];
  resources: string[];
  version: string;
  effectiveDate: string;
  status: '生效中' | '待评审' | '已停用';
  ownerDepartment: string;
}

export interface ReviewAction {
  id: string;
  title: string;
  ownerDepartment: string;
  owner: string;
  deadline: string;
  priority: '一般' | '重要' | '紧急';
  status: '待整改' | '整改中' | '已完成';
}

export interface EventReview {
  id: string;
  eventId: string;
  reviewCode: string;
  status: '待关闭' | '已关闭' | '已复盘';
  reviewer: string;
  summary: string;
  directCause: string;
  rootCause: string;
  lesson: string;
  controlledAt: string;
  closedAt?: string;
  timeline: Array<{ time: string; title: string; detail: string; status: 'done' | 'active' | 'pending' }>;
  actions: ReviewAction[];
}

export interface RiskUnit {
  id: string;
  code: string;
  name: string;
  parentName: string;
  areaId: string;
  areaName: string;
  ownerDepartment: string;
  owner: string;
  medium: string;
  accidentTypes: string[];
  staticLevel: RiskLevel;
  currentLevel: RiskLevel;
  controls: string[];
  linkedGds: number;
  linkedVoc: number;
  linkedMes: number;
  linkedPlans: number;
  dynamicFactors: Array<{
    source: 'GDS' | 'VOC' | 'MES' | '作业许可' | '隐患';
    label: string;
    impact: 'up' | 'watch';
    status: string;
  }>;
}

export type HazardStatus = '待整改' | '整改中' | '待验收' | '已关闭';

export interface Hazard {
  id: string;
  code: string;
  title: string;
  areaId: string;
  areaName: string;
  level: '一般' | '较大' | '重大';
  source: '现场检查' | '预警转化' | '专项检查' | '复盘整改';
  category: string;
  ownerDepartment: string;
  owner: string;
  discoveredAt: string;
  deadline: string;
  status: HazardStatus;
  riskUnitId: string;
  overdue: boolean;
  recurrenceCount: number;
  description: string;
  measures: string[];
}

export type WorkPermitStatus = '待审批' | '作业中' | '建议暂停' | '已暂停' | '已关闭';

export interface WorkPermit {
  id: string;
  code: string;
  type: '动火作业' | '受限空间' | '高处作业' | '吊装作业' | '临时用电';
  areaId: string;
  areaName: string;
  workContent: string;
  applicant: string;
  guardian: string;
  startAt: string;
  endAt: string;
  riskLevel: '一般' | '较大' | '重大';
  status: WorkPermitStatus;
  gasTest: string;
  linkedGdsCodes: string[];
  safetyMeasures: string[];
  alertReason?: string;
}

export type WarningRuleScenario =
  | 'gds-level2'
  | 'voc-overlimit'
  | 'joint-leak'
  | 'gds-trend'
  | 'permit-linkage';

export interface WarningRule {
  id: string;
  code: string;
  name: string;
  source: 'GDS' | 'VOC' | 'MES' | '联合预警' | '作业许可';
  scenario: WarningRuleScenario;
  level: RiskLevel;
  scope: string;
  condition: string;
  duration: string;
  notifyTargets: string[];
  enabled: boolean;
  triggerCount: number;
  lastTriggeredAt?: string;
  description: string;
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
  emergencyPlan: EmergencyPlan;
  emergencyPlans: EmergencyPlanTemplate[];
  emergencyTasks: EmergencyTask[];
  emergencyResources: EmergencyResource[];
  eventReviews: EventReview[];
  riskUnits: RiskUnit[];
  hazards: Hazard[];
  workPermits: WorkPermit[];
  warningRules: WarningRule[];
}
