import type {
  EmergencyDrillInput,
  EmergencyDrillRecordInput,
  EmergencyPlanDraftInput,
  EmergencyPlanTemplate,
  EmergencyPlanTemplateConfig,
} from '@/types/qhse';

function toConfig(input: EmergencyPlanDraftInput | EmergencyPlanTemplateConfig): EmergencyPlanTemplateConfig {
  return {
    name: input.name,
    category: input.category,
    eventType: input.eventType,
    applicableArea: input.applicableArea,
    medium: input.medium,
    responseLevel: input.responseLevel,
    triggerRule: input.triggerRule,
    notificationTargets: input.notificationTargets,
    steps: input.steps,
    resources: input.resources,
    effectiveDate: input.effectiveDate,
    expiryDate: input.expiryDate,
    ownerDepartment: input.ownerDepartment,
  };
}

export function getEmergencyPlanDisplayConfig(plan: EmergencyPlanTemplate) {
  return plan.draft ?? toConfig(plan);
}

export function saveEmergencyPlanDraft(
  plans: EmergencyPlanTemplate[],
  planId: string,
  input: EmergencyPlanDraftInput,
) {
  const config = toConfig(input);
  const existing = plans.find((plan) => plan.id === planId);
  if (existing) {
    return plans.map((plan) => plan.id === planId ? {
      ...plan,
      publishStatus: '草稿' as const,
      draft: config,
      reviewSteps: undefined,
    } : plan);
  }
  return [...plans, {
    id: planId,
    code: input.code,
    ...config,
    version: '未发布',
    status: '已停用' as const,
    publishStatus: '草稿' as const,
    draft: config,
    versions: [],
    drills: [],
  }];
}

export function submitEmergencyPlanForReview(plan: EmergencyPlanTemplate) {
  if (plan.publishStatus !== '草稿' || !plan.draft) return plan;
  return {
    ...plan,
    publishStatus: '待评审' as const,
    reviewSteps: [
      { role: 'QHSE 评审' as const, reviewer: '赵磊', status: '待评审' as const },
      { role: '生产负责人会签' as const, reviewer: '陈涛', status: '待评审' as const },
    ],
  };
}

export function approveEmergencyPlanReviewStep(plan: EmergencyPlanTemplate, reviewedAt: string) {
  if (plan.publishStatus !== '待评审') return plan;
  const nextIndex = plan.reviewSteps?.findIndex((step) => step.status === '待评审') ?? -1;
  if (nextIndex < 0) return plan;
  return {
    ...plan,
    reviewSteps: plan.reviewSteps?.map((step, index) => index === nextIndex ? {
      ...step,
      status: '已通过' as const,
      reviewedAt,
      signature: `${step.reviewer} / ${step.role}`,
    } : step),
  };
}

export function isEmergencyPlanFullyApproved(plan: EmergencyPlanTemplate) {
  return Boolean(plan.reviewSteps?.length && plan.reviewSteps.every((step) => step.status === '已通过'));
}

export function nextEmergencyPlanVersion(version: string) {
  const matched = /^V(\d+)\.(\d+)$/.exec(version);
  return matched ? `V${matched[1]}.${Number(matched[2]) + 1}` : 'V1.0';
}

export function publishEmergencyPlan(plan: EmergencyPlanTemplate, publishedAt: string, publisher: string) {
  if (plan.publishStatus !== '待评审' || !plan.draft || !isEmergencyPlanFullyApproved(plan)) return plan;
  const version = nextEmergencyPlanVersion(plan.version);
  return {
    ...plan,
    ...plan.draft,
    version,
    status: '生效中' as const,
    publishStatus: '已发布' as const,
    versions: [...plan.versions, { ...plan.draft, version, publishedAt, publisher }],
    draft: undefined,
  };
}

export function rollbackEmergencyPlan(plan: EmergencyPlanTemplate, version: string) {
  const target = plan.versions.find((item) => item.version === version);
  if (!target) return plan;
  return { ...plan, publishStatus: '草稿' as const, draft: toConfig(target), reviewSteps: undefined };
}

const diffFields: Array<{ key: keyof EmergencyPlanTemplateConfig; label: string }> = [
  { key: 'name', label: '预案名称' },
  { key: 'category', label: '预案类别' },
  { key: 'eventType', label: '事件类型' },
  { key: 'applicableArea', label: '适用区域' },
  { key: 'medium', label: '涉及介质' },
  { key: 'responseLevel', label: '响应等级' },
  { key: 'triggerRule', label: '触发规则' },
  { key: 'notificationTargets', label: '通知对象' },
  { key: 'steps', label: '处置步骤' },
  { key: 'resources', label: '资源清单' },
  { key: 'effectiveDate', label: '生效日期' },
  { key: 'expiryDate', label: '到期日期' },
  { key: 'ownerDepartment', label: '责任部门' },
];

function stringifyConfigValue(value: string | string[]) {
  return Array.isArray(value) ? value.join('、') : value;
}

export function compareEmergencyPlanConfigs(base: EmergencyPlanTemplateConfig, target: EmergencyPlanTemplateConfig) {
  return diffFields.flatMap(({ key, label }) => {
    const before = stringifyConfigValue(base[key]);
    const after = stringifyConfigValue(target[key]);
    return before === after ? [] : [{ key, label, before, after }];
  });
}

export function addEmergencyDrill(plan: EmergencyPlanTemplate, input: EmergencyDrillInput, id: string) {
  return {
    ...plan,
    drills: [...(plan.drills ?? []), { ...input, id, status: '计划中' as const }],
  };
}

export function startEmergencyDrill(plan: EmergencyPlanTemplate, drillId: string, startedAt: string) {
  return {
    ...plan,
    drills: (plan.drills ?? []).map((drill) => drill.id === drillId && drill.status === '计划中'
      ? { ...drill, status: '待复盘' as const, startedAt }
      : drill),
  };
}

export function recordEmergencyDrill(
  plan: EmergencyPlanTemplate,
  drillId: string,
  input: EmergencyDrillRecordInput,
  completedAt: string,
) {
  if (input.score < 0 || input.score > 100 || !input.summary.trim()) return plan;
  return {
    ...plan,
    drills: (plan.drills ?? []).map((drill) => drill.id === drillId && drill.status === '待复盘'
      ? { ...drill, ...input, status: '已完成' as const, completedAt }
      : drill),
  };
}

export function getEmergencyPlanExpiryState(plan: EmergencyPlanTemplate, today: string) {
  if (plan.version === '未发布') return '未生效' as const;
  const remaining = Math.ceil((Date.parse(plan.expiryDate) - Date.parse(today)) / 86400000);
  if (remaining < 0) return '已过期' as const;
  if (remaining <= 60) return '即将到期' as const;
  return '正常' as const;
}
