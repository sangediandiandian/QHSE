import type { Hazard, HazardEvidence, HazardInput } from '@/types/qhse';

function appendOperation(
  hazard: Hazard,
  action: NonNullable<Hazard['operations']>[number]['action'],
  operator: string,
  operatedAt: string,
  detail: string,
) {
  return {
    ...hazard,
    operations: [...(hazard.operations ?? []), { id: `${hazard.id}-${action}-${operatedAt}`, action, operator, operatedAt, detail }],
  };
}

export function createHazard(input: HazardInput, id: string, code: string, operator: string, operatedAt: string): Hazard {
  return appendOperation({
    ...input,
    id,
    code,
    status: '待整改',
    overdue: false,
    recurrenceCount: 0,
    supervised: input.level === '重大',
    evidence: [],
    operations: [],
  }, '上报', operator, operatedAt, '隐患已上报并生成整改任务');
}

export function addHazardEvidence(
  hazard: Hazard,
  evidence: Omit<HazardEvidence, 'id' | 'uploadedAt'>,
  id: string,
  uploadedAt: string,
): Hazard {
  return { ...hazard, evidence: [...(hazard.evidence ?? []), { ...evidence, id, uploadedAt }] };
}

export function startHazardRectification(hazard: Hazard, operator: string, operatedAt: string): Hazard {
  if (hazard.status !== '待整改') return hazard;
  return appendOperation({ ...hazard, status: '整改中' }, '开始整改', operator, operatedAt, '责任人已接收并开始整改');
}

export function submitHazardAcceptance(hazard: Hazard, operator: string, operatedAt: string): Hazard {
  if (hazard.status !== '整改中') return hazard;
  if (!(hazard.evidence?.length)) throw new Error('至少添加一项整改证据后才能提交验收');
  return appendOperation({ ...hazard, status: '待验收' }, '提交验收', operator, operatedAt, `已提交 ${hazard.evidence.length} 项整改证据`);
}

export function acceptAndCloseHazard(hazard: Hazard, opinion: string, operator: string, operatedAt: string): Hazard {
  if (hazard.status !== '待验收') return hazard;
  if (!opinion.trim()) throw new Error('验收意见不能为空');
  return appendOperation({ ...hazard, status: '已关闭', overdue: false, acceptanceOpinion: opinion.trim() }, '验收关闭', operator, operatedAt, opinion.trim());
}

export function toggleHazardSupervision(hazard: Hazard, operator: string, operatedAt: string): Hazard {
  const supervised = !hazard.supervised;
  return appendOperation({ ...hazard, supervised }, supervised ? '挂牌督办' : '解除挂牌', operator, operatedAt, supervised ? '已纳入挂牌督办清单' : '已解除挂牌督办');
}
