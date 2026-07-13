import type { GdsPoint, WorkPermit, WorkPermitApprovalStep, WorkPermitInput, WorkPermitSiteConfirmation } from '@/types/qhse';

const roles: WorkPermitApprovalStep['role'][] = ['属地审核', 'QHSE 审核', '负责人批准'];

export function createWorkPermit(input: WorkPermitInput, id: string, code: string): WorkPermit {
  return {
    ...input,
    id,
    code,
    status: '待审批',
    approvalSteps: roles.map((role) => ({
      role,
      approver: role === '属地审核' ? input.guardian : role === 'QHSE 审核' ? '赵磊' : input.applicant,
      status: '待审批',
    })),
    siteConfirmations: [],
  };
}

export function getWorkPermitApprovalSteps(permit: WorkPermit): WorkPermitApprovalStep[] {
  if (permit.approvalSteps) return permit.approvalSteps;
  const approved = permit.status !== '待审批';
  return roles.map((role) => ({
    role,
    approver: role === '属地审核' ? permit.guardian : role === 'QHSE 审核' ? '赵磊' : permit.applicant,
    status: approved ? '已通过' : '待审批',
    signedAt: approved ? permit.startAt : undefined,
    signature: approved ? `${role}电子签名` : undefined,
  }));
}

export function approveNextWorkPermitStep(permit: WorkPermit, approver: string, signedAt: string): WorkPermit {
  if (permit.status !== '待审批') return permit;
  let approved = false;
  const approvalSteps = getWorkPermitApprovalSteps(permit).map((step) => {
    if (approved || step.status === '已通过') return step;
    approved = true;
    return { ...step, approver, status: '已通过' as const, signedAt, signature: `${approver}（电子签名）` };
  });
  return { ...permit, approvalSteps };
}

export function confirmWorkPermitSite(
  permit: WorkPermit,
  role: WorkPermitSiteConfirmation['role'],
  confirmer: string,
  confirmedAt: string,
): WorkPermit {
  if (!getWorkPermitApprovalSteps(permit).every((step) => step.status === '已通过')) throw new Error('审批尚未全部通过');
  if (permit.siteConfirmations?.some((item) => item.role === role)) return permit;
  const siteConfirmations = [...(permit.siteConfirmations ?? []), { role, confirmer, confirmedAt }];
  return {
    ...permit,
    siteConfirmations,
    status: siteConfirmations.length === 2 ? '作业中' : permit.status,
  };
}

export function calculatePermitNearestGdsDistance(permit: WorkPermit, points: GdsPoint[]) {
  if (permit.workX === undefined || permit.workY === undefined) return undefined;
  const candidates = points.filter((point) => point.areaId === permit.areaId && point.x !== undefined && point.y !== undefined);
  if (!candidates.length) return undefined;
  return Math.round(Math.min(...candidates.map((point) => Math.hypot(permit.workX! - point.x!, permit.workY! - point.y!))) * 10);
}
