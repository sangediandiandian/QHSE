import type {
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
  }];
}

export function submitEmergencyPlanForReview(plan: EmergencyPlanTemplate) {
  if (plan.publishStatus !== '草稿' || !plan.draft) return plan;
  return { ...plan, publishStatus: '待评审' as const };
}

export function nextEmergencyPlanVersion(version: string) {
  const matched = /^V(\d+)\.(\d+)$/.exec(version);
  return matched ? `V${matched[1]}.${Number(matched[2]) + 1}` : 'V1.0';
}

export function publishEmergencyPlan(plan: EmergencyPlanTemplate, publishedAt: string, publisher: string) {
  if (plan.publishStatus !== '待评审' || !plan.draft) return plan;
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
  return { ...plan, publishStatus: '草稿' as const, draft: toConfig(target) };
}

export function getEmergencyPlanExpiryState(plan: EmergencyPlanTemplate, today: string) {
  if (plan.version === '未发布') return '未生效' as const;
  const remaining = Math.ceil((Date.parse(plan.expiryDate) - Date.parse(today)) / 86400000);
  if (remaining < 0) return '已过期' as const;
  if (remaining <= 60) return '即将到期' as const;
  return '正常' as const;
}
