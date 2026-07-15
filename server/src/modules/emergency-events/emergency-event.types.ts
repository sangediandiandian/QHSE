export const emergencyEventStatuses = ['待研判', '响应中', '监控中', '待关闭', '已关闭'] as const;
export type EmergencyEventStatus = (typeof emergencyEventStatuses)[number];
export const emergencyResponseLevels = ['IV级', 'III级', 'II级', 'I级'] as const;
export type EmergencyResponseLevel = (typeof emergencyResponseLevels)[number];
export const emergencySources = ['GDS', 'VOC', 'MES', '联合预警', '作业许可'] as const;
export type EmergencySource = (typeof emergencySources)[number];
export const emergencyActions = [
  '研判启动',
  '升级响应',
  '降级响应',
  '终止响应',
  '申请关闭',
  '审批关闭',
] as const;
export type EmergencyEventAction = (typeof emergencyActions)[number];
export const emergencyEvidenceCategories = [
  '现场照片',
  '监测报告',
  '处置记录',
  '审批材料',
] as const;
export type EmergencyEvidenceCategory = (typeof emergencyEvidenceCategories)[number];

export interface EmergencyEventOperation {
  id: string;
  action: EmergencyEventAction | '事件生成' | '告警确认' | '审批催办';
  operatorId: string;
  operator: string;
  operatedAt: string;
  fromStatus?: EmergencyEventStatus;
  toStatus: EmergencyEventStatus;
  fromLevel?: EmergencyResponseLevel;
  toLevel: EmergencyResponseLevel;
  detail: string;
}

export interface EmergencyEventEvidence {
  id: string;
  objectId?: string;
  name: string;
  category: EmergencyEvidenceCategory;
  uploaderId: string;
  uploader: string;
  uploadedAt: string;
  note: string;
  hash: string;
  contentType?: string;
  size?: number;
}

export interface EmergencyClosureApproval {
  id: string;
  workflowId: string;
  workflowVersion: number;
  type: '事件关闭';
  applicantId: string;
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

export interface EmergencyEvent {
  id: string;
  eventId: string;
  code: string;
  title: string;
  areaId: string;
  areaName: string;
  source: EmergencySource;
  status: EmergencyEventStatus;
  responseLevel: EmergencyResponseLevel;
  commander: string;
  ownerDepartment: string;
  startedAt: string;
  updatedAt: string;
  summary: string;
  operations: EmergencyEventOperation[];
  evidence: EmergencyEventEvidence[];
  closureApproval?: EmergencyClosureApproval;
  closureWorkflowId?: string;
  version: number;
  createdAt: string;
}

export interface EmergencyEventQuery {
  status?: EmergencyEventStatus;
  areaId?: string;
  areaIds?: string[];
  keyword?: string;
}

export interface EmergencyEventMutation {
  status?: EmergencyEventStatus;
  responseLevel?: EmergencyResponseLevel;
  commander?: string;
  operation?: EmergencyEventOperation;
  evidence?: EmergencyEventEvidence;
  closureApproval?: EmergencyClosureApproval;
  closureWorkflowId?: string;
  updatedAt: string;
}
