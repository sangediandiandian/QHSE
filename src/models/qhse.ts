import { getDashboard } from '@/services/qhse/dashboard';
import type {
  DashboardData,
  EmergencyDrillInput,
  EmergencyDrillRecordInput,
  EmergencyEvent,
  EmergencyEventAction,
  EmergencyEventEvidence,
  EmergencyPlanDraftInput,
  EmergencyResourceBatchInput,
  EmergencyResourceDispatchInput,
  EmergencyResourceInput,
  EmergencyResourceInspectionInput,
  Hazard,
  HazardEvidenceInput,
  HazardReportInput,
  RiskUnit,
  RiskAssessmentInput,
  RiskControlRecord,
  WorkPermit,
  WorkPermitApplyInput,
  WorkPermitSiteConfirmation,
  WarningEvidenceCategory,
  WarningRule,
  WarningRuleDraftInput,
  WarningSampleInput,
  WarningSignal,
} from '@/types/qhse';
import {
  addHazardEvidence as addHazardEvidenceByApi,
  closeHazard as closeHazardByApi,
  getHazardRiskUnits,
  getHazards,
  reportHazard,
  setHazardSupervision,
  startHazardRectification as startHazardByApi,
  submitHazardAcceptance as submitHazardByApi,
} from '@/services/qhse/hazards';
import {
  applyWorkPermit,
  approveWorkPermit as approveWorkPermitByApi,
  confirmWorkPermitSite as confirmWorkPermitSiteByApi,
  getWorkPermits,
  pauseWorkPermit,
  resumeWorkPermit,
} from '@/services/qhse/workPermits';
import {
  approveWarningRule as approveWarningRuleByApi,
  createWarningRuleDraft,
  evaluateWarningSample as evaluateWarningSampleByApi,
  getWarningRules,
  getWarningSignals,
  rollbackWarningRule as rollbackWarningRuleByApi,
  submitWarningRule as submitWarningRuleByApi,
  toggleWarningRule as toggleWarningRuleByApi,
  updateWarningRuleDraft,
} from '@/services/qhse/warningRules';
import {
  addEmergencyEvidence as addEmergencyEvidenceByApi,
  approveEmergencyClosure as approveEmergencyClosureByApi,
  getEmergencyEvents,
  remindEmergencyClosure as remindEmergencyClosureByApi,
  requestEmergencyClosure,
  transitionEmergencyEvent as transitionEmergencyEventByApi,
} from '@/services/qhse/emergencyEvents';
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
  addEmergencyResourceBatch as withAddedEmergencyResourceBatch,
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
  addEmergencyDrill as withAddedEmergencyDrill,
  approveEmergencyPlanReviewStep,
  isEmergencyPlanFullyApproved,
  publishEmergencyPlan as withPublishedEmergencyPlan,
  recordEmergencyDrill as withRecordedEmergencyDrill,
  rollbackEmergencyPlan,
  saveEmergencyPlanDraft,
  startEmergencyDrill as withStartedEmergencyDrill,
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

const hazardApiMode = process.env.REACT_APP_QHSE_DATA_MODE === 'api';

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
  const [hazardRecords, setHazardRecords] = useState<Hazard[]>([]);
  const [hazardRiskUnits, setHazardRiskUnits] = useState<RiskUnit[]>([]);
  const [hazardLoading, setHazardLoading] = useState(false);
  const [workPermitRecords, setWorkPermitRecords] = useState<WorkPermit[]>([]);
  const [workPermitAreas, setWorkPermitAreas] = useState<Array<{ id: string; name: string }>>([]);
  const [workPermitLoading, setWorkPermitLoading] = useState(false);
  const [warningRuleRecords, setWarningRuleRecords] = useState<WarningRule[]>([]);
  const [warningSignals, setWarningSignals] = useState<WarningSignal[]>([]);
  const [warningRuleLoading, setWarningRuleLoading] = useState(false);
  const [emergencyEventRecords, setEmergencyEventRecords] = useState<EmergencyEvent[]>([]);
  const [emergencyEventLoading, setEmergencyEventLoading] = useState(false);

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

  const loadHazards = useCallback(async () => {
    if (!hazardApiMode) {
      if (!dashboard) await loadDashboard();
      return;
    }
    setHazardLoading(true);
    try {
      const [hazards, risks] = await Promise.all([getHazards(), getHazardRiskUnits()]);
      setHazardRecords(hazards);
      setHazardRiskUnits(risks);
    } finally {
      setHazardLoading(false);
    }
  }, [dashboard, loadDashboard]);

  const loadWorkPermits = useCallback(async () => {
    if (!hazardApiMode) {
      if (!dashboard) await loadDashboard();
      return;
    }
    setWorkPermitLoading(true);
    try {
      const [permits, risks] = await Promise.all([getWorkPermits(), getHazardRiskUnits()]);
      setWorkPermitRecords(permits);
      setWorkPermitAreas(Array.from(new Map(risks.map((risk) => [risk.areaId, {
        id: risk.areaId,
        name: risk.areaName,
      }])).values()));
    } finally {
      setWorkPermitLoading(false);
    }
  }, [dashboard, loadDashboard]);

  const loadWarningRules = useCallback(async () => {
    if (!hazardApiMode) {
      if (!dashboard) await loadDashboard();
      return;
    }
    setWarningRuleLoading(true);
    try {
      const [rules, signals] = await Promise.all([getWarningRules(), getWarningSignals()]);
      setWarningRuleRecords(rules);
      setWarningSignals(signals);
    } finally {
      setWarningRuleLoading(false);
    }
  }, [dashboard, loadDashboard]);

  const loadEmergencyEvents = useCallback(async () => {
    if (!hazardApiMode) {
      if (!dashboard) await loadDashboard();
      return;
    }
    setEmergencyEventLoading(true);
    try {
      setEmergencyEventRecords(await getEmergencyEvents());
    } finally {
      setEmergencyEventLoading(false);
    }
  }, [dashboard, loadDashboard]);

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

  const addEmergencyResourceBatch = useCallback((resourceId: string, input: EmergencyResourceBatchInput) => {
    setDashboard((current) => current ? {
      ...current,
      emergencyResources: current.emergencyResources.map((resource) => resource.id === resourceId
        ? withAddedEmergencyResourceBatch(resource, input, `batch-${Date.now()}`)
        : resource),
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
      emergencyPlans: current.emergencyPlans.map((plan) => {
        if (plan.id !== planId) return plan;
        const reviewedAt = getCurrentTimestamp();
        const reviewed = approveEmergencyPlanReviewStep(plan, reviewedAt);
        if (!isEmergencyPlanFullyApproved(reviewed)) return reviewed;
        const publisher = reviewed.reviewSteps?.map((step) => step.signature).filter(Boolean).join('；') ?? '';
        return withPublishedEmergencyPlan(reviewed, reviewedAt, publisher);
      }),
    } : current);
  }, []);

  const addEmergencyDrill = useCallback((planId: string, input: EmergencyDrillInput) => {
    setDashboard((current) => current ? {
      ...current,
      emergencyPlans: current.emergencyPlans.map((plan) => plan.id === planId
        ? withAddedEmergencyDrill(plan, input, `drill-${Date.now()}`)
        : plan),
    } : current);
  }, []);

  const startEmergencyDrill = useCallback((planId: string, drillId: string) => {
    setDashboard((current) => current ? {
      ...current,
      emergencyPlans: current.emergencyPlans.map((plan) => plan.id === planId
        ? withStartedEmergencyDrill(plan, drillId, getCurrentTimestamp())
        : plan),
    } : current);
  }, []);

  const recordEmergencyDrill = useCallback((planId: string, drillId: string, input: EmergencyDrillRecordInput) => {
    setDashboard((current) => current ? {
      ...current,
      emergencyPlans: current.emergencyPlans.map((plan) => plan.id === planId
        ? withRecordedEmergencyDrill(plan, drillId, input, getCurrentTimestamp())
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

  const transitionEvent = useCallback(async (eventId: string, action: EmergencyEventAction) => {
    if (hazardApiMode) {
      const event = emergencyEventRecords.find((item) => item.id === eventId);
      if (!event) throw new Error('应急事件不存在');
      const updated = action === '申请关闭'
        ? await requestEmergencyClosure(eventId, event.version ?? 1)
        : await transitionEmergencyEventByApi(eventId, action as Exclude<EmergencyEventAction, '申请关闭' | '审批关闭'>, event.version ?? 1);
      setEmergencyEventRecords((items) => items.map((item) => item.id === eventId ? updated : item));
      return updated;
    }
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
  }, [emergencyEventRecords]);

  const addEmergencyEventEvidence = useCallback(async (eventId: string, evidence: Omit<EmergencyEventEvidence, 'id' | 'uploadedAt' | 'hash'>) => {
    if (hazardApiMode) {
      const event = emergencyEventRecords.find((item) => item.id === eventId);
      if (!event) throw new Error('应急事件不存在');
      const updated = await addEmergencyEvidenceByApi(eventId, evidence, event.version ?? 1);
      setEmergencyEventRecords((items) => items.map((item) => item.id === eventId ? updated : item));
      return updated;
    }
    setDashboard((current) => current ? {
      ...current,
      emergencyEvents: current.emergencyEvents.map((event) => event.id === eventId
        ? withAddedEmergencyEventEvidence(event, evidence, `event-evidence-${Date.now()}`, getCurrentTimestamp(), `META-${Date.now().toString(16).toUpperCase()}`)
        : event),
    } : current);
  }, [emergencyEventRecords]);

  const remindEmergencyClosureApproval = useCallback(async (eventId: string) => {
    if (hazardApiMode) {
      const event = emergencyEventRecords.find((item) => item.id === eventId);
      if (!event) throw new Error('应急事件不存在');
      const updated = await remindEmergencyClosureByApi(eventId, event.version ?? 1);
      setEmergencyEventRecords((items) => items.map((item) => item.id === eventId ? updated : item));
      return updated;
    }
    setDashboard((current) => current ? {
      ...current,
      emergencyEvents: current.emergencyEvents.map((event) => event.id === eventId
        ? withRemindedEmergencyClosureApproval(event, getCurrentTimestamp())
        : event),
    } : current);
  }, [emergencyEventRecords]);

  const approveEmergencyEventClosure = useCallback(async (eventId: string, opinion: string) => {
    if (hazardApiMode) {
      const event = emergencyEventRecords.find((item) => item.id === eventId);
      if (!event) throw new Error('应急事件不存在');
      const updated = await approveEmergencyClosureByApi(eventId, opinion, event.version ?? 1, event.closureApproval?.workflowVersion);
      setEmergencyEventRecords((items) => items.map((item) => item.id === eventId ? updated : item));
      return updated;
    }
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
  }, [emergencyEventRecords]);

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

  const addHazard = useCallback(async (input: HazardReportInput) => {
    if (hazardApiMode) {
      const created = await reportHazard(input);
      setHazardRecords((current) => [...current, created]);
      return created;
    }
    setDashboard((current) => {
      if (!current) return current;
      const unit = current.riskUnits.find((item) => item.id === input.riskUnitId);
      if (!unit) return current;
      const dateCode = getCurrentTimestamp().slice(0, 10).replace(/-/g, '');
      const code = `YH${dateCode}${String(current.hazards.length + 1).padStart(3, '0')}`;
      return {
        ...current,
        hazards: [...current.hazards, withCreatedHazard({
          ...input,
          areaId: unit.areaId,
          areaName: unit.areaName,
        }, `hazard-${Date.now()}`, code, '赵磊 / QHSE 管理部', getCurrentTimestamp())],
      };
    });
  }, []);

  const addHazardEvidence = useCallback(async (hazardId: string, evidence: HazardEvidenceInput) => {
    if (hazardApiMode) {
      const current = hazardRecords.find((item) => item.id === hazardId);
      if (!current) throw new Error('隐患不存在');
      const updated = await addHazardEvidenceByApi(hazardId, evidence, current.version ?? 1);
      setHazardRecords((items) => items.map((item) => item.id === hazardId ? updated : item));
      return updated;
    }
    setDashboard((current) => current ? {
      ...current,
      hazards: current.hazards.map((hazard) => hazard.id === hazardId
        ? withAddedHazardEvidence(hazard, {
          ...evidence,
          uploader: '赵磊 / QHSE 管理部',
        }, `evidence-${Date.now()}`, getCurrentTimestamp())
        : hazard),
    } : current);
  }, [hazardRecords]);

  const startHazard = useCallback(async (hazardId: string) => {
    if (hazardApiMode) {
      const current = hazardRecords.find((item) => item.id === hazardId);
      if (!current) throw new Error('隐患不存在');
      const updated = await startHazardByApi(hazardId, current.version ?? 1);
      setHazardRecords((items) => items.map((item) => item.id === hazardId ? updated : item));
      return updated;
    }
    setDashboard((current) => current ? {
      ...current,
      hazards: current.hazards.map((hazard) => hazard.id === hazardId
        ? startHazardRectification(hazard, hazard.owner, getCurrentTimestamp())
        : hazard),
    } : current);
  }, [hazardRecords]);

  const submitHazard = useCallback(async (hazardId: string) => {
    if (hazardApiMode) {
      const current = hazardRecords.find((item) => item.id === hazardId);
      if (!current) throw new Error('隐患不存在');
      const updated = await submitHazardByApi(hazardId, current.version ?? 1);
      setHazardRecords((items) => items.map((item) => item.id === hazardId ? updated : item));
      return updated;
    }
    setDashboard((current) => current ? {
      ...current,
      hazards: current.hazards.map((hazard) => hazard.id === hazardId
        ? submitHazardAcceptance(hazard, hazard.owner, getCurrentTimestamp())
        : hazard),
    } : current);
  }, [hazardRecords]);

  const acceptHazard = useCallback(async (hazardId: string, opinion: string) => {
    if (hazardApiMode) {
      const current = hazardRecords.find((item) => item.id === hazardId);
      if (!current) throw new Error('隐患不存在');
      const updated = await closeHazardByApi(hazardId, opinion, current.version ?? 1);
      setHazardRecords((items) => items.map((item) => item.id === hazardId ? updated : item));
      return updated;
    }
    setDashboard((current) => current ? {
      ...current,
      hazards: current.hazards.map((hazard) => hazard.id === hazardId
        ? acceptAndCloseHazard(hazard, opinion, '赵磊 / QHSE 管理部', getCurrentTimestamp())
        : hazard),
    } : current);
  }, [hazardRecords]);

  const toggleHazardSupervision = useCallback(async (hazardId: string) => {
    if (hazardApiMode) {
      const current = hazardRecords.find((item) => item.id === hazardId);
      if (!current) throw new Error('隐患不存在');
      const updated = await setHazardSupervision(
        hazardId,
        !current.supervised,
        current.version ?? 1,
      );
      setHazardRecords((items) => items.map((item) => item.id === hazardId ? updated : item));
      return updated;
    }
    setDashboard((current) => current ? {
      ...current,
      hazards: current.hazards.map((hazard) => hazard.id === hazardId
        ? withToggledHazardSupervision(hazard, '赵磊 / QHSE 管理部', getCurrentTimestamp())
        : hazard),
    } : current);
  }, [hazardRecords]);

  const triggerPermitLinkage = useCallback(() => {
    setDashboard((current) => current && isWarningScenarioEnabled(current, 'permit-linkage') ? {
      ...current,
      workPermits: applyPermitAlarmLinkage(current.workPermits, current.alarms),
    } : current);
  }, []);

  const toggleWarningRule = useCallback(async (ruleId: string) => {
    if (hazardApiMode) {
      const rule = warningRuleRecords.find((item) => item.id === ruleId);
      if (!rule) throw new Error('预警规则不存在');
      const updated = await toggleWarningRuleByApi(ruleId, !rule.enabled, rule.revision ?? 1);
      setWarningRuleRecords((items) => items.map((item) => item.id === ruleId ? updated : item));
      return updated;
    }
    setDashboard((current) => current ? {
      ...current,
      warningRules: current.warningRules.map((rule) => rule.id === ruleId
        && rule.version > 0 ? { ...rule, enabled: !rule.enabled }
        : rule),
    } : current);
  }, [warningRuleRecords]);

  const evaluateWarningSample = useCallback(async (input: WarningSampleInput) => {
    if (!hazardApiMode) {
      return {
        evaluatedRuleCount: dashboard?.warningRules.length ?? 0,
        triggeredSignals: [],
        suppressedRuleIds: [],
        linkedPermitIds: [],
      };
    }
    const result = await evaluateWarningSampleByApi(input);
    setWarningRuleRecords(await getWarningRules());
    if (result.triggeredSignals.length) {
      setWarningSignals((items) => [
        ...result.triggeredSignals,
        ...items.filter((item) => !result.triggeredSignals.some((signal) => signal.id === item.id)),
      ]);
    }
    return result;
  }, [dashboard]);

  const saveWarningRule = useCallback(async (ruleId: string | undefined, input: WarningRuleDraftInput) => {
    if (hazardApiMode) {
      const rule = warningRuleRecords.find((item) => item.id === ruleId);
      const updated = rule
        ? await updateWarningRuleDraft(rule.id, input, rule.revision ?? 1)
        : await createWarningRuleDraft(input);
      setWarningRuleRecords((items) => rule
        ? items.map((item) => item.id === rule.id ? updated : item)
        : [...items, updated]);
      return updated;
    }
    const localRuleId = ruleId ?? `rule-custom-${Date.now()}`;
    setDashboard((current) => current ? {
      ...current,
      warningRules: saveWarningRuleDraft(current.warningRules, localRuleId, input),
    } : current);
  }, [warningRuleRecords]);

  const submitWarningRule = useCallback(async (ruleId: string) => {
    if (hazardApiMode) {
      const rule = warningRuleRecords.find((item) => item.id === ruleId);
      if (!rule) throw new Error('预警规则不存在');
      const updated = await submitWarningRuleByApi(ruleId, rule.revision ?? 1);
      setWarningRuleRecords((items) => items.map((item) => item.id === ruleId ? updated : item));
      return updated;
    }
    setDashboard((current) => current ? {
      ...current,
      warningRules: current.warningRules.map((rule) => rule.id === ruleId
        ? submitWarningRuleForApproval(rule)
        : rule),
    } : current);
  }, [warningRuleRecords]);

  const approveWarningRule = useCallback(async (ruleId: string) => {
    if (hazardApiMode) {
      const rule = warningRuleRecords.find((item) => item.id === ruleId);
      if (!rule) throw new Error('预警规则不存在');
      const updated = await approveWarningRuleByApi(ruleId, rule.revision ?? 1, '规则配置校验通过，同意进入下一节点');
      setWarningRuleRecords((items) => items.map((item) => item.id === ruleId ? updated : item));
      return updated;
    }
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
  }, [warningRuleRecords]);

  const rollbackWarningRuleVersion = useCallback(async (ruleId: string, version: number) => {
    if (hazardApiMode) {
      const rule = warningRuleRecords.find((item) => item.id === ruleId);
      if (!rule) throw new Error('预警规则不存在');
      const updated = await rollbackWarningRuleByApi(ruleId, version, rule.revision ?? 1);
      setWarningRuleRecords((items) => items.map((item) => item.id === ruleId ? updated : item));
      return updated;
    }
    setDashboard((current) => current ? {
      ...current,
      warningRules: current.warningRules.map((rule) => rule.id === ruleId
        ? rollbackWarningRule(rule, version)
        : rule),
    } : current);
  }, [warningRuleRecords]);

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

  const advanceWorkPermit = useCallback(async (permitId: string) => {
    if (hazardApiMode) {
      const permit = workPermitRecords.find((item) => item.id === permitId);
      if (!permit) throw new Error('作业票不存在');
      const updated = permit.status === '建议暂停'
        ? await pauseWorkPermit(permitId, permit.version ?? 1)
        : permit.status === '已暂停'
          ? await resumeWorkPermit(permitId, `${getCurrentTimestamp()} 复测合格，准予恢复`, permit.version ?? 1)
          : permit;
      setWorkPermitRecords((items) => items.map((item) => item.id === permitId ? updated : item));
      return updated;
    }
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
  }, [workPermitRecords]);

  const addWorkPermit = useCallback(async (input: WorkPermitApplyInput) => {
    if (hazardApiMode) {
      const created = await applyWorkPermit(input);
      setWorkPermitRecords((items) => [...items, created]);
      return created;
    }
    setDashboard((current) => {
      if (!current) return current;
      const area = current.areas.find((item) => item.id === input.areaId);
      if (!area) return current;
      const code = `${{ 动火作业: 'DH', 受限空间: 'SX', 高处作业: 'GC', 吊装作业: 'DZ', 临时用电: 'LD' }[input.type]}-${getCurrentTimestamp().slice(0, 10).replace(/-/g, '')}-${String(current.workPermits.length + 1).padStart(3, '0')}`;
      return { ...current, workPermits: [...current.workPermits, withCreatedWorkPermit({
        ...input,
        areaName: area.name,
        applicant: '李建国',
      }, `permit-${Date.now()}`, code)] };
    });
  }, []);

  const approveWorkPermit = useCallback(async (permitId: string) => {
    if (hazardApiMode) {
      const permit = workPermitRecords.find((item) => item.id === permitId);
      if (!permit) throw new Error('作业票不存在');
      const updated = await approveWorkPermitByApi(permitId, permit.version ?? 1);
      setWorkPermitRecords((items) => items.map((item) => item.id === permitId ? updated : item));
      return updated;
    }
    setDashboard((current) => current ? {
      ...current,
      workPermits: current.workPermits.map((permit) => {
        if (permit.id !== permitId) return permit;
        const next = getWorkPermitApprovalSteps(permit).find((step) => step.status === '待审批');
        return approveNextWorkPermitStep(permit, next?.approver ?? '赵磊', getCurrentTimestamp());
      }),
    } : current);
  }, [workPermitRecords]);

  const confirmWorkPermitSite = useCallback(async (permitId: string, role: WorkPermitSiteConfirmation['role']) => {
    if (hazardApiMode) {
      const permit = workPermitRecords.find((item) => item.id === permitId);
      if (!permit) throw new Error('作业票不存在');
      const updated = await confirmWorkPermitSiteByApi(permitId, role, permit.version ?? 1);
      setWorkPermitRecords((items) => items.map((item) => item.id === permitId ? updated : item));
      return updated;
    }
    setDashboard((current) => current ? {
      ...current,
      workPermits: current.workPermits.map((permit) => permit.id === permitId
        ? withConfirmedWorkPermitSite(permit, role, role === '作业负责人' ? permit.applicant : permit.guardian, getCurrentTimestamp())
        : permit),
    } : current);
  }, [workPermitRecords]);

  return {
    dashboard,
    loading,
    loadDashboard,
    hazards: hazardApiMode ? hazardRecords : (dashboard?.hazards ?? []),
    hazardRiskUnits: hazardApiMode ? hazardRiskUnits : (dashboard?.riskUnits ?? []),
    hazardLoading: hazardApiMode ? hazardLoading : loading,
    loadHazards,
    workPermits: hazardApiMode ? workPermitRecords : (dashboard?.workPermits ?? []),
    workPermitAreas: hazardApiMode ? workPermitAreas : (dashboard?.areas ?? []),
    workPermitGdsPoints: hazardApiMode ? [] : (dashboard?.gdsPoints ?? []),
    workPermitAlarms: hazardApiMode ? [] : (dashboard?.alarms ?? []),
    workPermitLinkageAvailable: !hazardApiMode,
    workPermitLoading: hazardApiMode ? workPermitLoading : loading,
    loadWorkPermits,
    warningRules: hazardApiMode ? warningRuleRecords : (dashboard?.warningRules ?? []),
    warningSignals: hazardApiMode ? warningSignals : [],
    warningRuleLoading: hazardApiMode ? warningRuleLoading : loading,
    warningRuleApiMode: hazardApiMode,
    loadWarningRules,
    emergencyEvents: hazardApiMode ? emergencyEventRecords : (dashboard?.emergencyEvents ?? []),
    emergencyEventLoading: hazardApiMode ? emergencyEventLoading : loading,
    emergencyEventApiMode: hazardApiMode,
    loadEmergencyEvents,
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
    addEmergencyResourceBatch,
    dispatchEmergencyResource,
    confirmEmergencyResourceArrival,
    returnEmergencyResource,
    inspectEmergencyResource,
    saveEmergencyPlan,
    submitEmergencyPlan,
    approveEmergencyPlan,
    rollbackEmergencyPlanVersion,
    addEmergencyDrill,
    startEmergencyDrill,
    recordEmergencyDrill,
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
    evaluateWarningSample,
    saveWarningRule,
    submitWarningRule,
    approveWarningRule,
    rollbackWarningRuleVersion,
    resetDashboard,
  };
}
