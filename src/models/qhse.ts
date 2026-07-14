import { getDashboard } from '@/services/qhse/dashboard';
import type {
  DashboardData,
  EmergencyEventAction,
  EmergencyEventEvidence,
  EmergencyPlanDraftInput,
  EmergencyResourceDispatchInput,
  EmergencyResourceInput,
  EmergencyResourceInspectionInput,
  HazardEvidence,
  HazardInput,
  RiskAssessmentInput,
  RiskControlRecord,
  WorkPermitInput,
  WorkPermitSiteConfirmation,
  WarningEvidenceCategory,
  WarningRuleDraftInput,
} from '@/types/qhse';
import {
  withCommunicationConfirmation,
  withCommunicationEscalation,
  withSimulatedGdsAlarm,
  withSimulatedJointAlarm,
  withSimulatedVocAlarm,
} from '@/utils/dashboardScenario';
import { applyPermitAlarmLinkage, nextPermitStatus } from '@/utils/managementWorkflow';
import {
  clearPersistedDashboard,
  loadPersistedDashboard,
  persistDashboard,
} from '@/utils/dashboardPersistence';
import { isWarningScenarioEnabled, withWarningRuleTriggered } from '@/utils/warningRules';
import { assessRiskUnit as withAssessedRiskUnit, saveRiskControls as withSavedRiskControls } from '@/utils/riskWorkflow';
import {
  acceptAndCloseHazard,
  addHazardEvidence as withAddedHazardEvidence,
  createHazard as withCreatedHazard,
  startHazardRectification,
  submitHazardAcceptance,
  toggleHazardSupervision as withToggledHazardSupervision,
} from '@/utils/hazardWorkflow';
import {
  approveNextWorkPermitStep,
  confirmWorkPermitSite as withConfirmedWorkPermitSite,
  createWorkPermit as withCreatedWorkPermit,
  getWorkPermitApprovalSteps,
} from '@/utils/workPermitWorkflow';
import {
  addEmergencyEventEvidence as withAddedEmergencyEventEvidence,
  approveEmergencyEventClosure as withApprovedEmergencyEventClosure,
  createEmergencyClosureApproval,
  remindEmergencyClosureApproval as withRemindedEmergencyClosureApproval,
  transitionEmergencyEvent,
} from '@/utils/emergencyEventWorkflow';
import {
  addEmergencyResource as withAddedEmergencyResource,
  confirmEmergencyResourceArrival as withConfirmedResourceArrival,
  dispatchEmergencyResource as withDispatchedEmergencyResource,
  inspectEmergencyResource as withInspectedEmergencyResource,
  returnEmergencyResource as withReturnedEmergencyResource,
} from '@/utils/emergencyResourceWorkflow';
import {
  confirmWarningEvent,
  startWarningEmergency,
  verifyWarningEvidence as withVerifiedWarningEvidence,
} from '@/utils/warningEvidenceWorkflow';
import {
  publishEmergencyPlan as withPublishedEmergencyPlan,
  rollbackEmergencyPlan,
  saveEmergencyPlanDraft,
  submitEmergencyPlanForReview,
} from '@/utils/emergencyPlanWorkflow';
import {
  approveWarningRuleStep,
  isWarningRuleFullyApproved,
  publishWarningRule as withPublishedWarningRule,
  rollbackWarningRule,
  saveWarningRuleDraft,
  submitWarningRuleForApproval,
} from '@/utils/warningRuleWorkflow';
import { useCallback, useEffect, useState } from 'react';

function getBrowserStorage() {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function getCurrentTimestamp() {
  const now = new Date();
  const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((value) => String(value).padStart(2, '0'))
    .join('-');
  const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
  return `${date} ${time}`;
}

export default function useQhseModel() {
  const [dashboard, setDashboard] = useState<DashboardData>();
  const [loading, setLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const storage = getBrowserStorage();
      const persisted = storage ? loadPersistedDashboard(storage) : undefined;
      if (persisted) {
        setDashboard(persisted);
        return;
      }
      const response = await getDashboard();
      setDashboard(response.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const storage = getBrowserStorage();
    if (storage && dashboard) persistDashboard(storage, dashboard);
  }, [dashboard]);

  const simulateGdsAlarm = useCallback(() => {
    setDashboard((current) => {
      if (!current) return current;
      const occurredAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      if (!isWarningScenarioEnabled(current, 'gds-level2')) return current;
      const next = withSimulatedGdsAlarm(
        current,
        occurredAt,
        new Date().toLocaleString('zh-CN', { hour12: false }),
      );
      return next === current ? current : withWarningRuleTriggered(next, 'gds-level2', occurredAt);
    });
  }, []);

  const confirmAlarm = useCallback((eventId: string) => {
    setDashboard((current) => current ? {
      ...current,
      alarms: current.alarms.map((event) => event.id === eventId
        ? confirmWarningEvent(event, '张伟 / 装置负责人', getCurrentTimestamp())
        : event),
    } : current);
  }, []);

  const startEmergency = useCallback((eventId: string) => {
    setDashboard((current) => current ? {
      ...current,
      alarms: current.alarms.map((event) => event.id === eventId
        ? startWarningEmergency(event, '张伟 / 装置负责人', getCurrentTimestamp())
        : event),
    } : current);
  }, []);

  const verifyAlarmEvidence = useCallback((eventId: string, category: WarningEvidenceCategory) => {
    setDashboard((current) => current ? {
      ...current,
      alarms: current.alarms.map((event) => event.id === eventId
        ? withVerifiedWarningEvidence(event, category, '赵磊 / QHSE 值班', getCurrentTimestamp())
        : event),
    } : current);
  }, []);

  const simulateVocAlarm = useCallback(() => {
    setDashboard((current) => {
      if (!current) return current;
      if (!isWarningScenarioEnabled(current, 'voc-overlimit')) return current;
      const occurredAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      const next = withSimulatedVocAlarm(
        current,
        occurredAt,
        new Date().toLocaleString('zh-CN', { hour12: false }),
      );
      return next === current ? current : withWarningRuleTriggered(next, 'voc-overlimit', occurredAt);
    });
  }, []);

  const simulateJointAlarm = useCallback(() => {
    setDashboard((current) => {
      if (!current || !isWarningScenarioEnabled(current, 'joint-leak')) return current;
      const occurredAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      const next = withSimulatedJointAlarm(
        current,
        occurredAt,
        new Date().toLocaleString('zh-CN', { hour12: false }),
      );
      return next === current ? current : withWarningRuleTriggered(next, 'joint-leak', occurredAt);
    });
  }, []);

  const advanceCommunication = useCallback((eventId: string) => {
    setDashboard((current) => current ? withCommunicationEscalation(
      current,
      eventId,
      new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    ) : current);
  }, []);

  const confirmCommunication = useCallback((taskId: string) => {
    setDashboard((current) => current ? withCommunicationConfirmation(
      current,
      taskId,
      new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    ) : current);
  }, []);

  const advanceEmergencyTask = useCallback((taskId: string) => {
    setDashboard((current) => {
      if (!current) return current;
      return {
        ...current,
        emergencyTasks: current.emergencyTasks.map((task) => task.id === taskId ? {
          ...task,
          status: task.status === '待执行' ? '执行中' : task.status === '执行中' ? '已完成' : task.status,
          feedback: task.status === '执行中' ? '现场反馈已提交，任务完成' : task.feedback,
        } : task),
      };
    });
  }, []);

  const addEmergencyResource = useCallback((input: EmergencyResourceInput) => {
    setDashboard((current) => current ? {
      ...current,
      emergencyResources: withAddedEmergencyResource(current.emergencyResources, input, `resource-${Date.now()}`),
    } : current);
  }, []);

  const dispatchEmergencyResource = useCallback((
    resourceId: string,
    input: Omit<EmergencyResourceDispatchInput, 'id' | 'dispatchedAt'>,
  ) => {
    setDashboard((current) => current ? {
      ...current,
      emergencyResources: current.emergencyResources.map((resource) => resource.id === resourceId
        ? withDispatchedEmergencyResource(resource, {
          ...input,
          id: `dispatch-${Date.now()}`,
          dispatchedAt: getCurrentTimestamp(),
        })
        : resource),
    } : current);
  }, []);

  const confirmEmergencyResourceArrival = useCallback((resourceId: string, dispatchId: string) => {
    setDashboard((current) => current ? {
      ...current,
      emergencyResources: current.emergencyResources.map((resource) => resource.id === resourceId
        ? withConfirmedResourceArrival(resource, dispatchId, getCurrentTimestamp())
        : resource),
    } : current);
  }, []);

  const returnEmergencyResource = useCallback((resourceId: string, dispatchId: string) => {
    setDashboard((current) => current ? {
      ...current,
      emergencyResources: current.emergencyResources.map((resource) => resource.id === resourceId
        ? withReturnedEmergencyResource(resource, dispatchId, getCurrentTimestamp())
        : resource),
    } : current);
  }, []);

  const inspectEmergencyResource = useCallback((
    resourceId: string,
    input: Omit<EmergencyResourceInspectionInput, 'id' | 'inspectedAt'>,
  ) => {
    setDashboard((current) => current ? {
      ...current,
      emergencyResources: current.emergencyResources.map((resource) => resource.id === resourceId
        ? withInspectedEmergencyResource(resource, {
          ...input,
          id: `inspection-${Date.now()}`,
          inspectedAt: getCurrentTimestamp(),
        })
        : resource),
    } : current);
  }, []);

  const saveEmergencyPlan = useCallback((planId: string, input: EmergencyPlanDraftInput) => {
    setDashboard((current) => current ? {
      ...current,
      emergencyPlans: saveEmergencyPlanDraft(current.emergencyPlans, planId, input),
    } : current);
  }, []);

  const submitEmergencyPlan = useCallback((planId: string) => {
    setDashboard((current) => current ? {
      ...current,
      emergencyPlans: current.emergencyPlans.map((plan) => plan.id === planId
        ? submitEmergencyPlanForReview(plan)
        : plan),
    } : current);
  }, []);

  const approveEmergencyPlan = useCallback((planId: string) => {
    setDashboard((current) => current ? {
      ...current,
      emergencyPlans: current.emergencyPlans.map((plan) => plan.id === planId
        ? withPublishedEmergencyPlan(
          plan,
          new Date().toLocaleString('zh-CN', { hour12: false }),
          '赵磊 / QHSE 管理部',
        )
        : plan),
    } : current);
  }, []);

  const rollbackEmergencyPlanVersion = useCallback((planId: string, version: string) => {
    setDashboard((current) => current ? {
      ...current,
      emergencyPlans: current.emergencyPlans.map((plan) => plan.id === planId
        ? rollbackEmergencyPlan(plan, version)
        : plan),
    } : current);
  }, []);

  const advanceReviewAction = useCallback((actionId: string) => {
    setDashboard((current) => current ? {
      ...current,
      eventReviews: current.eventReviews.map((review) => ({
        ...review,
        actions: review.actions.map((action) => action.id === actionId ? {
          ...action,
          status: action.status === '待整改' ? '整改中' : action.status === '整改中' ? '已完成' : action.status,
        } : action),
      })),
    } : current);
  }, []);

  const closeEventReview = useCallback((reviewId: string) => {
    setDashboard((current) => current ? {
      ...current,
      eventReviews: current.eventReviews.map((review) => review.id === reviewId ? {
        ...review,
        status: '已复盘',
        closedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
        timeline: review.timeline.map((item) => item.title === '事件关闭' ? {
          ...item,
          time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
          detail: '关闭审批通过，复盘报告与整改证据已归档',
          status: 'done',
        } : item),
      } : review),
    } : current);
  }, []);

  const transitionEvent = useCallback((eventId: string, action: EmergencyEventAction) => {
    setDashboard((current) => {
      if (!current) return current;
      const operatedAt = new Date().toLocaleString('zh-CN', { hour12: false });
      const event = current.emergencyEvents.find((item) => item.id === eventId);
      if (!event) return current;
      const operator = action === '审批关闭' ? '赵磊 / QHSE 管理部' : event.commander;
      const transitionedEvent = transitionEmergencyEvent(event, action, operator, operatedAt);
      const transitioned = action === '申请关闭'
        ? createEmergencyClosureApproval(transitionedEvent, event.commander, '赵磊 / QHSE 管理部', operatedAt)
        : transitionedEvent;
      if (transitioned === event) return current;
      const alarmStatus = transitioned.status === '响应中' ? '处置中' : '监控中';
      return {
        ...current,
        emergencyEvents: current.emergencyEvents.map((item) => item.id === eventId ? transitioned : item),
        alarms: current.alarms.map((alarm) => alarm.id === transitioned.eventId
          ? { ...alarm, status: alarmStatus }
          : alarm),
        emergencyPlan: current.emergencyPlan.eventId === transitioned.eventId ? {
          ...current.emergencyPlan,
          responseLevel: transitioned.responseLevel,
          status: transitioned.status === '响应中' ? '已启动' : '已终止',
        } : current.emergencyPlan,
      };
    });
  }, []);

  const addEmergencyEventEvidence = useCallback((eventId: string, evidence: Omit<EmergencyEventEvidence, 'id' | 'uploadedAt' | 'hash'>) => {
    setDashboard((current) => current ? {
      ...current,
      emergencyEvents: current.emergencyEvents.map((event) => event.id === eventId
        ? withAddedEmergencyEventEvidence(event, evidence, `event-evidence-${Date.now()}`, getCurrentTimestamp(), `META-${Date.now().toString(16).toUpperCase()}`)
        : event),
    } : current);
  }, []);

  const remindEmergencyClosureApproval = useCallback((eventId: string) => {
    setDashboard((current) => current ? {
      ...current,
      emergencyEvents: current.emergencyEvents.map((event) => event.id === eventId
        ? withRemindedEmergencyClosureApproval(event, getCurrentTimestamp())
        : event),
    } : current);
  }, []);

  const approveEmergencyEventClosure = useCallback((eventId: string, opinion: string) => {
    setDashboard((current) => {
      if (!current) return current;
      const event = current.emergencyEvents.find((item) => item.id === eventId);
      if (!event) return current;
      const approved = withApprovedEmergencyEventClosure(event, event.closureApproval?.assignee ?? '赵磊 / QHSE 管理部', opinion, getCurrentTimestamp());
      return {
        ...current,
        emergencyEvents: current.emergencyEvents.map((item) => item.id === eventId ? approved : item),
        alarms: current.alarms.map((alarm) => alarm.id === approved.eventId ? { ...alarm, status: '监控中' } : alarm),
      };
    });
  }, []);

  const assessRiskUnit = useCallback((riskUnitId: string, input: RiskAssessmentInput) => {
    setDashboard((current) => current ? {
      ...current,
      riskUnits: current.riskUnits.map((unit) => unit.id === riskUnitId
        ? withAssessedRiskUnit(unit, input, `assessment-${Date.now()}`, getCurrentTimestamp())
        : unit),
    } : current);
  }, []);

  const saveRiskControls = useCallback((riskUnitId: string, controls: Array<Pick<RiskControlRecord, 'content' | 'owner' | 'status'>>) => {
    setDashboard((current) => current ? {
      ...current,
      riskUnits: current.riskUnits.map((unit) => unit.id === riskUnitId
        ? withSavedRiskControls(unit, controls, getCurrentTimestamp())
        : unit),
    } : current);
  }, []);

  const addHazard = useCallback((input: HazardInput) => {
    setDashboard((current) => {
      if (!current) return current;
      const dateCode = getCurrentTimestamp().slice(0, 10).replace(/-/g, '');
      const code = `YH${dateCode}${String(current.hazards.length + 1).padStart(3, '0')}`;
      return {
        ...current,
        hazards: [...current.hazards, withCreatedHazard(input, `hazard-${Date.now()}`, code, '赵磊 / QHSE 管理部', getCurrentTimestamp())],
      };
    });
  }, []);

  const addHazardEvidence = useCallback((hazardId: string, evidence: Omit<HazardEvidence, 'id' | 'uploadedAt'>) => {
    setDashboard((current) => current ? {
      ...current,
      hazards: current.hazards.map((hazard) => hazard.id === hazardId
        ? withAddedHazardEvidence(hazard, evidence, `evidence-${Date.now()}`, getCurrentTimestamp())
        : hazard),
    } : current);
  }, []);

  const startHazard = useCallback((hazardId: string) => {
    setDashboard((current) => current ? {
      ...current,
      hazards: current.hazards.map((hazard) => hazard.id === hazardId
        ? startHazardRectification(hazard, hazard.owner, getCurrentTimestamp())
        : hazard),
    } : current);
  }, []);

  const submitHazard = useCallback((hazardId: string) => {
    setDashboard((current) => current ? {
      ...current,
      hazards: current.hazards.map((hazard) => hazard.id === hazardId
        ? submitHazardAcceptance(hazard, hazard.owner, getCurrentTimestamp())
        : hazard),
    } : current);
  }, []);

  const acceptHazard = useCallback((hazardId: string, opinion: string) => {
    setDashboard((current) => current ? {
      ...current,
      hazards: current.hazards.map((hazard) => hazard.id === hazardId
        ? acceptAndCloseHazard(hazard, opinion, '赵磊 / QHSE 管理部', getCurrentTimestamp())
        : hazard),
    } : current);
  }, []);

  const toggleHazardSupervision = useCallback((hazardId: string) => {
    setDashboard((current) => current ? {
      ...current,
      hazards: current.hazards.map((hazard) => hazard.id === hazardId
        ? withToggledHazardSupervision(hazard, '赵磊 / QHSE 管理部', getCurrentTimestamp())
        : hazard),
    } : current);
  }, []);

  const triggerPermitLinkage = useCallback(() => {
    setDashboard((current) => current && isWarningScenarioEnabled(current, 'permit-linkage') ? {
      ...current,
      workPermits: applyPermitAlarmLinkage(current.workPermits, current.alarms),
    } : current);
  }, []);

  const toggleWarningRule = useCallback((ruleId: string) => {
    setDashboard((current) => current ? {
      ...current,
      warningRules: current.warningRules.map((rule) => rule.id === ruleId
        && rule.version > 0 ? { ...rule, enabled: !rule.enabled }
        : rule),
    } : current);
  }, []);

  const saveWarningRule = useCallback((ruleId: string, input: WarningRuleDraftInput) => {
    setDashboard((current) => current ? {
      ...current,
      warningRules: saveWarningRuleDraft(current.warningRules, ruleId, input),
    } : current);
  }, []);

  const submitWarningRule = useCallback((ruleId: string) => {
    setDashboard((current) => current ? {
      ...current,
      warningRules: current.warningRules.map((rule) => rule.id === ruleId
        ? submitWarningRuleForApproval(rule)
        : rule),
    } : current);
  }, []);

  const approveWarningRule = useCallback((ruleId: string) => {
    setDashboard((current) => current ? {
      ...current,
      warningRules: current.warningRules.map((rule) => {
        if (rule.id !== ruleId) return rule;
        const nextStep = rule.approvalSteps?.find((step) => step.status === '待审批');
        const approved = approveWarningRuleStep(rule, nextStep?.approver ?? '赵磊', getCurrentTimestamp());
        return isWarningRuleFullyApproved(approved)
          ? withPublishedWarningRule(approved, getCurrentTimestamp(), approved.approvalSteps!.map((step) => step.approver).join('、'))
          : approved;
      }),
    } : current);
  }, []);

  const rollbackWarningRuleVersion = useCallback((ruleId: string, version: number) => {
    setDashboard((current) => current ? {
      ...current,
      warningRules: current.warningRules.map((rule) => rule.id === ruleId
        ? rollbackWarningRule(rule, version)
        : rule),
    } : current);
  }, []);

  const resetDashboard = useCallback(async () => {
    const storage = getBrowserStorage();
    if (storage) clearPersistedDashboard(storage);
    setLoading(true);
    try {
      const response = await getDashboard();
      setDashboard(response.data);
    } finally {
      setLoading(false);
    }
  }, []);

  const advanceWorkPermit = useCallback((permitId: string) => {
    setDashboard((current) => current ? {
      ...current,
      workPermits: current.workPermits.map((permit) => {
        if (permit.id !== permitId) return permit;
        const status = nextPermitStatus(permit.status);
        return {
          ...permit,
          status,
          gasTest: permit.status === '已暂停' ? `${new Date().toLocaleTimeString('zh-CN', { hour12: false })} 复测合格，准予恢复` : permit.gasTest,
          alertReason: status === '作业中' ? undefined : permit.alertReason,
        };
      }),
    } : current);
  }, []);

  const addWorkPermit = useCallback((input: WorkPermitInput) => {
    setDashboard((current) => {
      if (!current) return current;
      const code = `${{ 动火作业: 'DH', 受限空间: 'SX', 高处作业: 'GC', 吊装作业: 'DZ', 临时用电: 'LD' }[input.type]}-${getCurrentTimestamp().slice(0, 10).replace(/-/g, '')}-${String(current.workPermits.length + 1).padStart(3, '0')}`;
      return { ...current, workPermits: [...current.workPermits, withCreatedWorkPermit(input, `permit-${Date.now()}`, code)] };
    });
  }, []);

  const approveWorkPermit = useCallback((permitId: string) => {
    setDashboard((current) => current ? {
      ...current,
      workPermits: current.workPermits.map((permit) => {
        if (permit.id !== permitId) return permit;
        const next = getWorkPermitApprovalSteps(permit).find((step) => step.status === '待审批');
        return approveNextWorkPermitStep(permit, next?.approver ?? '赵磊', getCurrentTimestamp());
      }),
    } : current);
  }, []);

  const confirmWorkPermitSite = useCallback((permitId: string, role: WorkPermitSiteConfirmation['role']) => {
    setDashboard((current) => current ? {
      ...current,
      workPermits: current.workPermits.map((permit) => permit.id === permitId
        ? withConfirmedWorkPermitSite(permit, role, role === '作业负责人' ? permit.applicant : permit.guardian, getCurrentTimestamp())
        : permit),
    } : current);
  }, []);

  return {
    dashboard,
    loading,
    loadDashboard,
    simulateGdsAlarm,
    confirmAlarm,
    startEmergency,
    verifyAlarmEvidence,
    simulateVocAlarm,
    simulateJointAlarm,
    advanceCommunication,
    confirmCommunication,
    advanceEmergencyTask,
    addEmergencyResource,
    dispatchEmergencyResource,
    confirmEmergencyResourceArrival,
    returnEmergencyResource,
    inspectEmergencyResource,
    saveEmergencyPlan,
    submitEmergencyPlan,
    approveEmergencyPlan,
    rollbackEmergencyPlanVersion,
    advanceReviewAction,
    closeEventReview,
    transitionEvent,
    addEmergencyEventEvidence,
    remindEmergencyClosureApproval,
    approveEmergencyEventClosure,
    assessRiskUnit,
    saveRiskControls,
    addHazard,
    addHazardEvidence,
    startHazard,
    submitHazard,
    acceptHazard,
    toggleHazardSupervision,
    triggerPermitLinkage,
    advanceWorkPermit,
    addWorkPermit,
    approveWorkPermit,
    confirmWorkPermitSite,
    toggleWarningRule,
    saveWarningRule,
    submitWarningRule,
    approveWarningRule,
    rollbackWarningRuleVersion,
    resetDashboard,
  };
}
