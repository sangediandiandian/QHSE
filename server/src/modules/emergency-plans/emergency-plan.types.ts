export interface EmergencyPlanConfig {
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
export interface EmergencyPlanVersion extends EmergencyPlanConfig {
  version: string;
  publishedAt: string;
  publisher: string;
  publisherId: string;
}
export interface EmergencyPlanReviewStep {
  role: 'QHSE 评审' | '生产负责人会签';
  reviewer: string;
  status: '待评审' | '已通过';
  reviewedAt?: string;
  signature?: string;
}
export interface EmergencyDrill {
  id: string;
  title: string;
  type: '桌面推演' | '专项演练' | '综合演练';
  plannedAt: string;
  location: string;
  leader: string;
  participants: string[];
  status: '计划中' | '待复盘' | '已完成';
  startedAt?: string;
  completedAt?: string;
  score?: number;
  summary?: string;
  issues?: string[];
}
export interface EmergencyPlan extends EmergencyPlanConfig {
  id: string;
  code: string;
  version: string;
  status: '生效中' | '已停用';
  publishStatus: '草稿' | '待评审' | '已发布';
  draft?: EmergencyPlanConfig;
  versions: EmergencyPlanVersion[];
  reviewSteps?: EmergencyPlanReviewStep[];
  drills: EmergencyDrill[];
  workflowId?: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export interface EmergencyPlanMutation {
  config?: EmergencyPlanConfig;
  draft?: EmergencyPlanConfig;
  clearDraft?: boolean;
  publishStatus?: EmergencyPlan['publishStatus'];
  status?: EmergencyPlan['status'];
  version?: string;
  versionRecord?: EmergencyPlanVersion;
  reviewSteps?: EmergencyPlanReviewStep[];
  clearReviewSteps?: boolean;
  workflowId?: string;
  drill?: EmergencyDrill;
  drills?: EmergencyDrill[];
  updatedAt: string;
}
