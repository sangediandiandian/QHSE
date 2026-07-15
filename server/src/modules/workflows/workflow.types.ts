export type WorkflowStatus = '进行中' | '已通过' | '已驳回' | '已撤回';
export type WorkflowStepStatus = '待审批' | '已通过' | '已驳回';

export interface WorkflowStep {
  id: string;
  sequence: number;
  name: string;
  allowedRoleCodes: string[];
  status: WorkflowStepStatus;
  actorId?: string;
  actorName?: string;
  opinion?: string;
  actedAt?: string;
}

export interface WorkflowInstance {
  id: string;
  businessType: string;
  businessId: string;
  title: string;
  status: WorkflowStatus;
  createdById: string;
  createdByName: string;
  steps: WorkflowStep[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowMutation {
  status?: WorkflowStatus;
  step?: WorkflowStep;
  updatedAt: string;
}

export interface CreateWorkflowInput {
  businessType: string;
  businessId: string;
  title: string;
  steps: Array<Pick<WorkflowStep, 'name' | 'allowedRoleCodes'>>;
}
