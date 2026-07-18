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
  evidenceChecks?: WarningEvidenceCheck[];
  operations?: WarningEventOperation[];
  version?: number;
}

export type WarningEvidenceCategory = '监测数据' | '工艺参数' | '作业票证' | '关联人员';

export interface WarningEvidenceCheck {
  category: WarningEvidenceCategory;
  checkedBy: string;
  checkedAt: string;
}

export interface WarningEventOperation {
  id: string;
  type: '证据核验' | '事件确认' | '预案启动' | '处置启动' | '预警关闭';
  operator: string;
  operatedAt: string;
  detail: string;
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
  x?: number;
  y?: number;
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

export type TelemetrySource = 'GDS' | 'VOC' | 'MES';
export interface TelemetryPoint {
  id: string;
  code: string;
  source: TelemetrySource;
  name: string;
  areaId: string;
  areaName: string;
  equipmentName: string;
  metricKey: string;
  unit: string;
  configuration: Record<string, string | number | boolean>;
  currentMetrics: Record<string, string | number | boolean>;
  status: string;
  onlineStatus: DeviceOnlineStatus;
  lastSampleAt?: string;
  version: number;
}

export interface TelemetryIngestInput {
  sampleId: string;
  pointId: string;
  source: TelemetrySource;
  occurredAt: string;
  metrics: Record<string, string | number | boolean>;
  quality: 'good' | 'uncertain' | 'bad';
}

export interface TelemetryStreamEvent {
  streamId: string;
  sequence: number;
  emittedAt: string;
  point: TelemetryPoint;
  sample: {
    id: string;
    pointId: string;
    source: TelemetrySource;
    occurredAt: string;
    metrics: Record<string, string | number | boolean>;
    quality: 'good' | 'uncertain' | 'bad';
    createdAt: string;
  };
  outOfOrder: boolean;
  clockDriftMs: number;
}

export type TelemetryRealtimeStatus = 'disabled' | 'connecting' | 'connected' | 'disconnected' | 'unauthorized';

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
  confirmedBy?: string;
  sentBy?: string;
  retryCount: number;
  escalationLevel: 0 | 1 | 2 | 3;
}

export interface CommunicationDispatch {
  id: string;
  eventId: string;
  eventCode: string;
  eventTitle: string;
  areaName: string;
  eventLevel: 'low' | 'medium' | 'high' | 'critical';
  status: '待确认' | '已确认' | '升级完成';
  escalationLevel: 0 | 1 | 2 | 3;
  tasks: CommunicationTask[];
  version: number;
  createdAt: string;
  updatedAt: string;
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
  totalQuantity: number;
  availableQuantity: number;
  unit: string;
  location: string;
  eta: string;
  status: '待命' | '调度中' | '已到位';
  owner: string;
  contact: string;
  lastInspection: string;
  nextInspection: string;
  inspectionStatus: '检查合格' | '即将到期' | '需要维护';
  batches?: EmergencyResourceBatch[];
  dispatches: EmergencyResourceDispatch[];
  inspectionRecords: EmergencyResourceInspection[];
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type EmergencyResourceDispatchStatus = '调度中' | '已到位' | '已归还';
export type EmergencyResourceBatchStatus = '正常' | '即将到期' | '已过期';

export interface EmergencyResourceBatch {
  id: string;
  batchNo: string;
  quantity: number;
  availableQuantity: number;
  receivedAt: string;
  expiryDate: string;
}

export interface EmergencyResourceBatchAllocation {
  batchId: string;
  batchNo: string;
  quantity: number;
}

export interface EmergencyResourceDispatch {
  id: string;
  eventName: string;
  destination: string;
  quantity: number;
  operator: string;
  dispatchedAt: string;
  originalEta: string;
  arrivedAt?: string;
  returnedAt?: string;
  status: EmergencyResourceDispatchStatus;
  batchAllocations?: EmergencyResourceBatchAllocation[];
}

export interface EmergencyResourceInspection {
  id: string;
  inspector: string;
  inspectedAt: string;
  result: EmergencyResource['inspectionStatus'];
  nextInspection: string;
  note: string;
}

export interface EmergencyResourceInput {
  code: string;
  name: string;
  type: EmergencyResource['type'];
  totalQuantity: number;
  unit: string;
  location: string;
  eta: string;
  owner: string;
  contact: string;
  nextInspection: string;
  batchNo: string;
  receivedAt: string;
  expiryDate: string;
}

export interface EmergencyResourceBatchInput {
  batchNo: string;
  quantity: number;
  receivedAt: string;
  expiryDate: string;
}

export interface EmergencyResourceDispatchInput {
  id: string;
  eventName: string;
  destination: string;
  quantity: number;
  operator: string;
  dispatchedAt: string;
}

export interface EmergencyResourceInspectionInput {
  id: string;
  inspector: string;
  inspectedAt: string;
  result: EmergencyResource['inspectionStatus'];
  nextInspection: string;
  note: string;
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

export interface EmergencyPlanTemplateConfig {
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
  effectiveDate: string;
  expiryDate: string;
  ownerDepartment: string;
}

export type EmergencyPlanPublishStatus = '草稿' | '待评审' | '已发布';

export interface EmergencyPlanVersion extends EmergencyPlanTemplateConfig {
  version: string;
  publishedAt: string;
  publisher: string;
}

export interface EmergencyPlanReviewStep {
  role: 'QHSE 评审' | '生产负责人会签';
  reviewer: string;
  status: '待评审' | '已通过';
  reviewedAt?: string;
  signature?: string;
}

export type EmergencyDrillStatus = '计划中' | '待复盘' | '已完成';

export interface EmergencyDrill {
  id: string;
  title: string;
  type: '桌面推演' | '专项演练' | '综合演练';
  plannedAt: string;
  location: string;
  leader: string;
  participants: string[];
  status: EmergencyDrillStatus;
  startedAt?: string;
  completedAt?: string;
  score?: number;
  summary?: string;
  issues?: string[];
}

export type EmergencyDrillInput = Omit<EmergencyDrill, 'id' | 'status' | 'startedAt' | 'completedAt' | 'score' | 'summary' | 'issues'>;

export interface EmergencyDrillRecordInput {
  score: number;
  summary: string;
  issues: string[];
}

export interface EmergencyPlanTemplate extends EmergencyPlanTemplateConfig {
  id: string;
  code: string;
  version: string;
  status: '生效中' | '已停用';
  publishStatus: EmergencyPlanPublishStatus;
  draft?: EmergencyPlanTemplateConfig;
  versions: EmergencyPlanVersion[];
  reviewSteps?: EmergencyPlanReviewStep[];
  drills?: EmergencyDrill[];
  workflowId?: string;
  revision?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type EmergencyPlanDraftInput = EmergencyPlanTemplateConfig & { code: string };

export interface ReviewAction {
  id: string;
  title: string;
  ownerDepartment: string;
  owner: string;
  deadline: string;
  priority: '一般' | '重要' | '紧急';
  status: '待整改' | '整改中' | '已完成';
  updatedById?: string;
  updatedBy?: string;
  updatedAt?: string;
  completedAt?: string;
}

export interface EventReviewEvidence {
  id: string;
  objectId: string;
  name: string;
  category: '调查报告' | '现场照片' | '检测报告' | '培训记录';
  note: string;
  uploaderId: string;
  uploader: string;
  uploadedAt: string;
  hash: string;
  contentType?: string;
  size?: number;
}

export type EventReviewActionInput = Pick<
  ReviewAction,
  'title' | 'ownerDepartment' | 'owner' | 'deadline' | 'priority'
>;

export interface EventReview {
  id: string;
  eventId: string;
  eventCode?: string;
  eventTitle?: string;
  areaId?: string;
  areaName?: string;
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
  evidence?: EventReviewEvidence[];
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type EmergencyEventStatus = '待研判' | '响应中' | '监控中' | '待关闭' | '已关闭';
export type EmergencyResponseLevel = 'IV级' | 'III级' | 'II级' | 'I级';
export type EmergencyEventAction = '研判启动' | '升级响应' | '降级响应' | '终止响应' | '申请关闭' | '审批关闭';

export interface EmergencyEventOperation {
  id: string;
  action: EmergencyEventAction | '事件生成' | '告警确认';
  operator: string;
  operatedAt: string;
  fromStatus?: EmergencyEventStatus;
  toStatus: EmergencyEventStatus;
  fromLevel?: EmergencyResponseLevel;
  toLevel: EmergencyResponseLevel;
  detail: string;
}

export interface EmergencyEvent {
  id: string;
  eventId: string;
  code: string;
  title: string;
  areaId: string;
  areaName: string;
  source: AlarmEvent['source'];
  status: EmergencyEventStatus;
  responseLevel: EmergencyResponseLevel;
  commander: string;
  ownerDepartment: string;
  startedAt: string;
  updatedAt: string;
  summary: string;
  operations: EmergencyEventOperation[];
  evidence?: EmergencyEventEvidence[];
  closureApproval?: EmergencyEventApprovalTask;
  version?: number;
  createdAt?: string;
}

export interface EmergencyEventEvidence {
  id: string;
  objectId?: string;
  name: string;
  category: '现场照片' | '监测报告' | '处置记录' | '审批材料';
  uploader: string;
  uploadedAt: string;
  note: string;
  hash: string;
  contentType?: string;
  size?: number;
}

export interface Attachment {
  id: string;
  originalName: string;
  contentType: string;
  size: number;
  sha256: string;
  uploader: string;
  areaId: string;
  businessType?: 'hazard' | 'emergency_event' | 'emergency_plan' | 'drill';
  businessId?: string;
  status: 'uploaded' | 'bound';
  createdAt: string;
  boundAt?: string;
  downloadUrl: string;
}

export interface ReportMetric {
  total: number;
  open: number;
  closed: number;
  rate: number;
  overdue?: number;
  critical?: number;
  active?: number;
}

export interface ReportTrendPoint {
  date: string;
  hazardCreated: number;
  hazardClosed: number;
  warningTriggered: number;
  emergencyCreated: number;
  emergencyClosed: number;
}

export interface ReportAreaRow {
  areaId: string;
  areaName: string;
  hazardTotal: number;
  hazardOpen: number;
  hazardOverdue: number;
  hazardClosureRate: number;
  warningTotal: number;
  warningCritical: number;
  permitTotal: number;
  permitActive: number;
  emergencyTotal: number;
  emergencyOpen: number;
  riskIndex: number;
}

export interface ReportSummary {
  range: { from: string; to: string; areaId?: string };
  generatedAt: string;
  hazards: ReportMetric;
  warnings: ReportMetric;
  permits: ReportMetric;
  emergencies: ReportMetric;
  trend: ReportTrendPoint[];
  areas: ReportAreaRow[];
}

export interface ReportExportJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  filename?: string;
  backend: 'memory' | 'redis';
}

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

export interface IntegrationConfig {
  id: string;
  code: string;
  name: string;
  type: 'telemetry' | 'communication' | 'identity' | 'storage';
  protocol: 'HTTP' | 'HTTPS' | 'MQTT' | 'MQTTS';
  endpoint: string;
  enabled: boolean;
  timeoutMs: number;
  owner: string;
  healthStatus: 'unchecked' | 'connected' | 'degraded' | 'disconnected';
  lastCheckedAt?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SystemDiagnostics {
  service: {
    name: string;
    status: string;
    repository: 'memory' | 'prisma';
    objectStorage: 'local' | 's3';
    nodeVersion: string;
    uptimeSeconds: number;
    accessLogging: 'json' | 'disabled';
  };
  memory: {
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    externalBytes: number;
  };
  integrations: {
    total: number;
    enabled: number;
    unhealthy: number;
    items: Array<Pick<IntegrationConfig, 'code' | 'name' | 'type' | 'enabled' | 'healthStatus' | 'lastCheckedAt' | 'owner'>>;
  };
  requests: {
    startedAt: string;
    totalRequests: number;
    totalErrors: number;
    routes: Array<{
      method: string;
      path: string;
      count: number;
      errorCount: number;
      averageDurationMs: number;
      durationMaxMs: number;
      errorRate: number;
      lastStatus: number;
      lastSeenAt: string;
    }>;
  };
  cache: {
    backend: 'memory' | 'redis';
    status: 'ready' | 'degraded';
    hits: number;
    misses: number;
    writes: number;
    failures: number;
    inFlight: number;
    lastErrorAt?: string;
    lastSuccessAt?: string;
  };
  queue: {
    backend: 'memory' | 'redis';
    status: 'ready' | 'degraded';
    failures: number;
    lastErrorAt?: string;
    lastSuccessAt?: string;
    retainedJobs?: number;
  };
  sessions: {
    backend: 'memory' | 'redis';
    status: 'ready' | 'degraded';
    operations: number;
    failures: number;
    lastErrorAt?: string;
    lastSuccessAt?: string;
  };
  tracing: {
    exporter: 'disabled' | 'otlp-http';
    spansStarted: number;
    spansEnded: number;
    lastSpanEndedAt?: string;
  };
  generatedAt: string;
}

export interface EmergencyEventApprovalTask {
  id: string;
  workflowId?: string;
  workflowVersion?: number;
  type: '事件关闭';
  applicantId?: string;
  applicant: string;
  assignee: string;
  status: '待审批' | '已通过';
  createdAt: string;
  dueAt: string;
  approvedAt?: string;
  signature?: string;
  opinion?: string;
  reminderCount: number;
  lastReminderAt?: string;
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
  assessments?: RiskAssessment[];
  controlRecords?: RiskControlRecord[];
  version?: number;
}

export interface RiskAssessment {
  id: string;
  assessorId?: string;
  method: 'LEC';
  likelihood: number;
  exposure: number;
  consequence: number;
  score: number;
  level: RiskLevel;
  assessor: string;
  assessedAt: string;
  basis: string;
}

export interface RiskAssessmentInput {
  likelihood: number;
  exposure: number;
  consequence: number;
  assessor: string;
  basis: string;
}

export interface RiskControlRecord {
  id: string;
  content: string;
  owner: string;
  status: '有效' | '待验证';
  updatedAt: string;
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
  supervised?: boolean;
  evidence?: HazardEvidence[];
  acceptanceOpinion?: string;
  operations?: HazardOperation[];
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface HazardEvidence {
  id: string;
  objectId?: string;
  name: string;
  category: '整改前' | '整改过程' | '整改完成';
  uploader: string;
  uploaderId?: string;
  uploadedAt: string;
  note?: string;
  contentType?: string;
  size?: number;
  sha256?: string;
}

export interface HazardOperation {
  id: string;
  action: '上报' | '开始整改' | '提交验收' | '验收关闭' | '挂牌督办' | '解除挂牌';
  operator: string;
  operatorId?: string;
  operatedAt: string;
  detail: string;
}

export interface HazardInput {
  title: string;
  areaId: string;
  areaName: string;
  level: Hazard['level'];
  source: Hazard['source'];
  category: string;
  ownerDepartment: string;
  owner: string;
  discoveredAt: string;
  deadline: string;
  riskUnitId: string;
  description: string;
  measures: string[];
}

export type HazardReportInput = Omit<HazardInput, 'areaId' | 'areaName'>;
export type HazardEvidenceInput = Pick<HazardEvidence, 'name' | 'category' | 'note' | 'objectId'>;

export interface HazardQuery {
  status?: HazardStatus;
  level?: Hazard['level'];
  areaId?: string;
  keyword?: string;
  overdue?: boolean;
  supervised?: boolean;
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
  applicantId?: string;
  guardian: string;
  startAt: string;
  endAt: string;
  riskLevel: '一般' | '较大' | '重大';
  status: WorkPermitStatus;
  gasTest: string;
  linkedGdsCodes: string[];
  safetyMeasures: string[];
  alertReason?: string;
  workX?: number;
  workY?: number;
  approvalSteps?: WorkPermitApprovalStep[];
  siteConfirmations?: WorkPermitSiteConfirmation[];
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkPermitApprovalStep {
  id?: string;
  sequence?: number;
  role: '属地审核' | 'QHSE 审核' | '负责人批准';
  approver: string;
  approverId?: string;
  status: '待审批' | '已通过';
  signedAt?: string;
  signature?: string;
}

export interface WorkPermitSiteConfirmation {
  id?: string;
  role: '作业负责人' | '现场监护人';
  confirmer: string;
  confirmerId?: string;
  confirmedAt: string;
}

export interface WorkPermitInput {
  type: WorkPermit['type'];
  areaId: string;
  areaName: string;
  workContent: string;
  applicant: string;
  guardian: string;
  startAt: string;
  endAt: string;
  riskLevel: WorkPermit['riskLevel'];
  gasTest: string;
  linkedGdsCodes: string[];
  safetyMeasures: string[];
  workX: number;
  workY: number;
}

export type WorkPermitApplyInput = Omit<WorkPermitInput, 'areaName' | 'applicant'>;

export type WarningRuleScenario =
  | 'gds-level2'
  | 'voc-overlimit'
  | 'joint-leak'
  | 'gds-trend'
  | 'permit-linkage';

export interface WarningRuleConfig {
  name: string;
  source: 'GDS' | 'VOC' | 'MES' | '联合预警' | '作业许可';
  scenario: WarningRuleScenario;
  level: RiskLevel;
  scope: string;
  condition: string;
  duration: string;
  notifyTargets: string[];
  description: string;
  expression?: WarningRuleExpressionItem[];
  rolloutPercentage?: 25 | 50 | 100;
}

export interface WarningRuleExpressionItem {
  metric: string;
  operator: '>' | '>=' | '<' | '<=' | '=';
  threshold: string;
  connector: 'AND' | 'OR';
}

export type WarningRulePublishStatus = '草稿' | '待审批' | '已发布';

export interface WarningRuleVersion extends WarningRuleConfig {
  id?: string;
  version: number;
  publishedAt: string;
  publisher: string;
  publisherId?: string;
}

export interface WarningRule extends WarningRuleConfig {
  id: string;
  code: string;
  enabled: boolean;
  triggerCount: number;
  lastTriggeredAt?: string;
  publishStatus: WarningRulePublishStatus;
  version: number;
  draft?: WarningRuleConfig;
  versions: WarningRuleVersion[];
  approvalSteps?: WarningRuleApprovalStep[];
  revision?: number;
  workflowId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WarningRuleApprovalStep {
  role: 'QHSE 会签' | '生产负责人会签';
  approver: string;
  status: '待审批' | '已通过';
  approvedAt?: string;
}

export type WarningRuleDraftInput = WarningRuleConfig & { code: string };

export interface WarningSignal {
  id: string;
  code: string;
  ruleId: string;
  ruleCode: string;
  subjectId: string;
  areaId?: string;
  source: string;
  level: RiskLevel;
  title: string;
  detail: string;
  occurredAt: string;
  status: 'active' | 'acknowledged' | 'processing' | 'closed';
  operations: Array<{
    id: string;
    action: '证据核验' | '确认' | '开始处置' | '关闭';
    operatorId: string;
    operator: string;
    operatedAt: string;
    detail: string;
  }>;
  evidenceChecks: Array<{
    category: WarningEvidenceCategory;
    checkedById: string;
    checkedBy: string;
    checkedAt: string;
  }>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WarningSampleInput {
  source: 'GDS' | 'VOC' | 'MES' | '联合预警';
  subjectId: string;
  areaId?: string;
  occurredAt: string;
  metrics: Record<string, string | number | boolean>;
}

export interface WarningEvaluationResult {
  evaluatedRuleCount: number;
  triggeredSignals: WarningSignal[];
  suppressedRuleIds: string[];
  linkedPermitIds: string[];
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
  emergencyEvents: EmergencyEvent[];
}
