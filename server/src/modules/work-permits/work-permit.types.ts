export const workPermitStatuses = ['待审批', '作业中', '建议暂停', '已暂停', '已关闭'] as const;
export type WorkPermitStatus = (typeof workPermitStatuses)[number];

export const workPermitTypes = [
  '动火作业',
  '受限空间',
  '高处作业',
  '吊装作业',
  '临时用电',
] as const;
export type WorkPermitType = (typeof workPermitTypes)[number];

export const workPermitRiskLevels = ['一般', '较大', '重大'] as const;
export type WorkPermitRiskLevel = (typeof workPermitRiskLevels)[number];

export const workPermitApprovalRoles = ['属地审核', 'QHSE 审核', '负责人批准'] as const;
export type WorkPermitApprovalRole = (typeof workPermitApprovalRoles)[number];

export const workPermitConfirmationRoles = ['作业负责人', '现场监护人'] as const;
export type WorkPermitConfirmationRole = (typeof workPermitConfirmationRoles)[number];

export interface WorkPermitApprovalStep {
  id: string;
  sequence: number;
  role: WorkPermitApprovalRole;
  approverId?: string;
  approver: string;
  status: '待审批' | '已通过';
  signedAt?: string;
  signature?: string;
}

export interface WorkPermitSiteConfirmation {
  id: string;
  role: WorkPermitConfirmationRole;
  confirmerId: string;
  confirmer: string;
  confirmedAt: string;
}

export interface WorkPermit {
  id: string;
  code: string;
  type: WorkPermitType;
  areaId: string;
  areaName: string;
  workContent: string;
  applicantId: string;
  applicant: string;
  guardian: string;
  startAt: string;
  endAt: string;
  riskLevel: WorkPermitRiskLevel;
  status: WorkPermitStatus;
  gasTest: string;
  linkedGdsCodes: string[];
  safetyMeasures: string[];
  alertReason?: string;
  workX: number;
  workY: number;
  approvalSteps: WorkPermitApprovalStep[];
  siteConfirmations: WorkPermitSiteConfirmation[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkPermitQuery {
  status?: WorkPermitStatus;
  type?: WorkPermitType;
  riskLevel?: WorkPermitRiskLevel;
  areaId?: string;
  areaIds?: string[];
  keyword?: string;
}

export interface WorkPermitMutation {
  status?: WorkPermitStatus;
  gasTest?: string;
  alertReason?: string | null;
  approval?: WorkPermitApprovalStep;
  confirmation?: WorkPermitSiteConfirmation;
  updatedAt: string;
}
