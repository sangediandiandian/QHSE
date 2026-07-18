import { getDashboard } from '@/services/qhse/dashboard';
import {
  assessRiskUnit as assessRiskUnitByApi,
  saveRiskControls as saveRiskControlsByApi,
} from '@/services/qhse/risks';
import type {
  AlarmEvent,
  DashboardData,
  CommunicationDispatch,
  EmergencyDrillInput,
  EmergencyDrillRecordInput,
  EmergencyEvent,
  EmergencyEventAction,
  EmergencyEventEvidence,
  EmergencyPlanDraftInput,
  EmergencyPlanTemplate,
  EmergencyResource,
  EmergencyResourceBatchInput,
  EmergencyResourceDispatchInput,
  EmergencyResourceInput,
  EmergencyResourceInspectionInput,
  GdsPoint,
  Hazard,
  HazardEvidenceInput,
  HazardReportInput,
  RiskUnit,
  RiskAssessmentInput,
  RiskControlRecord,
  MesTag,
  TelemetryIngestInput,
  TelemetryPoint,
  TelemetryRealtimeStatus,
  VocPoint,
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
  pauseWorkPermit,
  resumeWorkPermit,
} from '@/services/qhse/workPermits';
import { getWorkPermitLinkageSnapshot } from '@/services/qhse/workPermitLinkage';
import {
  approveWarningRule as approveWarningRuleByApi,
  acknowledgeWarningSignal,
  closeWarningSignal,
  createWarningRuleDraft,
  evaluateWarningSample as evaluateWarningSampleByApi,
  getWarningRules,
  getWarningSignals,
  rollbackWarningRule as rollbackWarningRuleByApi,
  submitWarningRule as submitWarningRuleByApi,
  startWarningEmergencyResponse,
  verifyWarningSignalEvidence,
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
  addEmergencyDrill as addEmergencyDrillByApi,
  approveEmergencyPlan as approveEmergencyPlanByApi,
  createEmergencyPlan,
  getEmergencyPlans,
  recordEmergencyDrill as recordEmergencyDrillByApi,
  rollbackEmergencyPlan as rollbackEmergencyPlanByApi,
  startEmergencyDrill as startEmergencyDrillByApi,
  submitEmergencyPlan as submitEmergencyPlanByApi,
  updateEmergencyPlan,
} from '@/services/qhse/emergencyPlans';
import {
  addEmergencyResourceBatch as addEmergencyResourceBatchByApi,
  confirmEmergencyResourceArrival as confirmEmergencyResourceArrivalByApi,
  createEmergencyResource,
  dispatchEmergencyResource as dispatchEmergencyResourceByApi,
  getEmergencyResources,
  inspectEmergencyResource as inspectEmergencyResourceByApi,
  returnEmergencyResource as returnEmergencyResourceByApi,
} from '@/services/qhse/emergencyResources';
import {
  confirmCommunicationTask as confirmCommunicationTaskByApi,
  escalateCommunication as escalateCommunicationByApi,
  getCommunicationDispatches,
} from '@/services/qhse/communications';
import {
  connectTelemetryStream,
  getTelemetryPoints,
  ingestTelemetrySample as ingestTelemetrySampleByApi,
  toGdsPoint,
  toMesTag,
  toVocPoint,
} from '@/services/qhse/telemetry';
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
import { getWorkPermitLinkageSummary, isWorkPermitLinkageEnabled } from '@/utils/workPermitLinkage';
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

function withSignalState(event: AlarmEvent, signal: WarningSignal): AlarmEvent {
  const status = {
    active: '待确认',
    acknowledged: '已确认',
    processing: '处置中',
    closed: '监控中',
  } as const;
  const operationType = {
    证据核验: '证据核验',
    确认: '事件确认',
    开始处置: '处置启动',
    关闭: '预警关闭',
  } as const;
  return {
    ...event,
    status: status[signal.status],
    version: signal.version,
    operations: signal.operations.map((operation) => ({
      id: operation.id,
      type: operationType[operation.action],
      operator: operation.operator,
      operatedAt: operation.operatedAt,
      detail: operation.detail,
    })),
    evidenceChecks: signal.evidenceChecks.map((check) => ({
      category: check.category,
      checkedBy: check.checkedBy,
      checkedAt: check.checkedAt,
    })),
  };
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
  const [emergencyPlanRecords, setEmergencyPlanRecords] = useState<EmergencyPlanTemplate[]>([]);
  const [emergencyPlanLoading, setEmergencyPlanLoading] = useState(false);
  const [emergencyResourceRecords, setEmergencyResourceRecords] = useState<EmergencyResource[]>([]);
  const [emergencyResourceLoading, setEmergencyResourceLoading] = useState(false);
  const [communicationRecords, setCommunicationRecords] = useState<CommunicationDispatch[]>([]);
  const [communicationLoading, setCommunicationLoading] = useState(false);
  const [gdsPointRecords, setGdsPointRecords] = useState<GdsPoint[]>([]);
  const [vocPointRecords, setVocPointRecords] = useState<VocPoint[]>([]);
  const [mesTagRecords, setMesTagRecords] = useState<MesTag[]>([]);
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [telemetryRealtimeStatus, setTelemetryRealtimeStatus] = useState<TelemetryRealtimeStatus>('disabled');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const storage = getBrowserStorage();
      const persisted = !hazardApiMode && storage ? loadPersistedDashboard(storage) : undefined;
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

  const refreshWorkPermitLinkageRecords = useCallback(async () => {
    const snapshot = await getWorkPermitLinkageSnapshot();
    setWorkPermitRecords(snapshot.permits);
    setWorkPermitAreas(snapshot.areas);
    setGdsPointRecords(snapshot.gdsPoints);
    setWarningRuleRecords(snapshot.rules);
    setWarningSignals(snapshot.signals);
    return { permits: snapshot.permits, signals: snapshot.signals };
  }, []);

  const loadWorkPermits = useCallback(async () => {
    if (!hazardApiMode) {
      if (!dashboard) await loadDashboard();
      return;
    }
    setWorkPermitLoading(true);
    try {
      await refreshWorkPermitLinkageRecords();
    } finally {
      setWorkPermitLoading(false);
    }
  }, [dashboard, loadDashboard, refreshWorkPermitLinkageRecords]);

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

  const loadEmergencyPlans = useCallback(async () => {
    if (!hazardApiMode) { if (!dashboard) await loadDashboard(); return; }
    setEmergencyPlanLoading(true);
    try { setEmergencyPlanRecords(await getEmergencyPlans()); } finally { setEmergencyPlanLoading(false); }
  }, [dashboard, loadDashboard]);

  const loadEmergencyResources = useCallback(async () => {
    if (!hazardApiMode) { if (!dashboard) await loadDashboard(); return; }
    setEmergencyResourceLoading(true);
    try { setEmergencyResourceRecords(await getEmergencyResources()); } finally { setEmergencyResourceLoading(false); }
  }, [dashboard, loadDashboard]);

  const loadCommunications = useCallback(async () => {
    if (!hazardApiMode) { if (!dashboard) await loadDashboard(); return; }
    setCommunicationLoading(true);
    try { setCommunicationRecords(await getCommunicationDispatches()); } finally { setCommunicationLoading(false); }
  }, [dashboard, loadDashboard]);

  const loadTelemetry = useCallback(async () => {
    if (!hazardApiMode) { if (!dashboard) await loadDashboard(); return; }
    setTelemetryLoading(true);
    try {
      const [gds, voc, mes] = await Promise.all([
        getTelemetryPoints('GDS'), getTelemetryPoints('VOC'), getTelemetryPoints('MES'),
      ]);
      setGdsPointRecords(gds.map(toGdsPoint));
      setVocPointRecords(voc.map(toVocPoint));
      setMesTagRecords(mes.map(toMesTag));
    } finally { setTelemetryLoading(false); }
  }, [dashboard, loadDashboard]);

  const applyTelemetryPoint = useCallback((point: TelemetryPoint) => {
    if (point.source === 'GDS') setGdsPointRecords((items) => items.map((item) => item.id === point.id ? toGdsPoint(point) : item));
    if (point.source === 'VOC') setVocPointRecords((items) => items.map((item) => item.id === point.id ? toVocPoint(point) : item));
    if (point.source === 'MES') setMesTagRecords((items) => items.map((item) => item.id === point.id ? toMesTag(point) : item));
  }, []);

  const ingestTelemetrySample = useCallback(async (input: TelemetryIngestInput) => {
    if (!hazardApiMode) return undefined;
    const result = await ingestTelemetrySampleByApi(input);
    applyTelemetryPoint(result.point);
    await refreshWorkPermitLinkageRecords();
    return result;
  }, [applyTelemetryPoint, refreshWorkPermitLinkageRecords]);

  useEffect(() => {
    if (!hazardApiMode) return undefined;
    return connectTelemetryStream({
      onSample: (event) => { if (!event.outOfOrder) applyTelemetryPoint(event.point); },
      onStatus: setTelemetryRealtimeStatus,
    });
  }, [applyTelemetryPoint]);

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

  const confirmAlarm = useCallback(async (eventId: string) => {
    if (hazardApiMode) {
      const event = dashboard?.alarms.find((item) => item.id === eventId);
      if (!event?.version) throw new Error('预警信号不存在或不支持确认');
      const signal = await acknowledgeWarningSignal(eventId, event.version);
      setDashboard((current) => current ? {
        ...current,
        alarms: current.alarms.map((alarm) => alarm.id === eventId ? withSignalState(alarm, signal) : alarm),
      } : current);
      return signal;
    }
    setDashboard((current) => current ? {
      ...current,
      alarms: current.alarms.map((event) => event.id === eventId
        ? confirmWarningEvent(event, '张伟 / 装置负责人', getCurrentTimestamp())
        : event),
    } : current);
    return undefined;
  }, [dashboard]);

  const startEmergency = useCallback(async (eventId: string) => {
    if (hazardApiMode) {
      const event = dashboard?.alarms.find((item) => item.id === eventId);
      if (!event?.version) throw new Error('预警信号不存在或不支持处置');
      const result = await startWarningEmergencyResponse(eventId, event.version);
      setDashboard((current) => current ? {
        ...current,
        alarms: current.alarms.map((alarm) => alarm.id === eventId ? withSignalState(alarm, result.signal) : alarm),
        emergencyEvents: current.emergencyEvents.some((item) => item.id === result.event.id)
          ? current.emergencyEvents
          : [result.event, ...current.emergencyEvents],
      } : current);
      setEmergencyEventRecords((items) => items.some((item) => item.id === result.event.id)
        ? items
        : [result.event, ...items]);
      return result;
    }
    setDashboard((current) => current ? {
      ...current,
      alarms: current.alarms.map((event) => event.id === eventId
        ? startWarningEmergency(event, '张伟 / 装置负责人', getCurrentTimestamp())
        : event),
    } : current);
    return undefined;
  }, [dashboard]);

  const closeAlarm = useCallback(async (eventId: string, reason: string) => {
    if (!hazardApiMode) return undefined;
    const event = dashboard?.alarms.find((item) => item.id === eventId);
    if (!event?.version) throw new Error('预警信号不存在或不支持关闭');
    const signal = await closeWarningSignal(eventId, event.version, reason);
    setDashboard((current) => current ? {
      ...current,
      alarms: current.alarms.filter((alarm) => alarm.id !== eventId),
      metrics: {
        ...current.metrics,
        activeAlarms: Math.max(0, current.metrics.activeAlarms - 1),
      },
    } : current);
    return signal;
  }, [dashboard]);

  const verifyAlarmEvidence = useCallback(async (eventId: string, category: WarningEvidenceCategory) => {
    if (hazardApiMode) {
      const event = dashboard?.alarms.find((item) => item.id === eventId);
      if (!event?.version) throw new Error('预警信号不存在或不支持证据核验');
      const signal = await verifyWarningSignalEvidence(eventId, event.version, category);
      setDashboard((current) => current ? {
        ...current,
        alarms: current.alarms.map((alarm) => alarm.id === eventId ? withSignalState(alarm, signal) : alarm),
      } : current);
      return signal;
    }
    setDashboard((current) => current ? {
      ...current,
      alarms: current.alarms.map((event) => event.id === eventId
        ? withVerifiedWarningEvidence(event, category, '赵磊 / QHSE 值班', getCurrentTimestamp())
        : event),
    } : current);
    return undefined;
  }, [dashboard]);

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

  const advanceCommunication = useCallback(async (eventId: string) => {
    if (hazardApiMode) {
      const item = communicationRecords.find((entry) => entry.eventId === eventId);
      if (!item) throw new Error('通信事件不存在');
      const updated = await escalateCommunicationByApi(eventId, item.version);
      setCommunicationRecords((records) => records.map((entry) => entry.eventId === eventId ? updated : entry));
      return updated;
    }
    setDashboard((current) => current ? withCommunicationEscalation(
      current,
      eventId,
      new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    ) : current);
  }, [communicationRecords]);

  const confirmCommunication = useCallback(async (taskId: string) => {
    if (hazardApiMode) {
      const item = communicationRecords.find((entry) => entry.tasks.some((task) => task.id === taskId));
      if (!item) throw new Error('通信任务不存在');
      const updated = await confirmCommunicationTaskByApi(item.eventId, taskId, item.version);
      setCommunicationRecords((records) => records.map((entry) => entry.eventId === item.eventId ? updated : entry));
      return updated;
    }
    setDashboard((current) => current ? withCommunicationConfirmation(
      current,
      taskId,
      new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    ) : current);
  }, [communicationRecords]);

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

  const addEmergencyResource = useCallback(async (input: EmergencyResourceInput) => {
    if (hazardApiMode) { const created = await createEmergencyResource(input); setEmergencyResourceRecords((items) => [...items, created]); return created; }
    setDashboard((current) => current ? {
      ...current,
      emergencyResources: withAddedEmergencyResource(current.emergencyResources, input, `resource-${Date.now()}`),
    } : current);
  }, []);

  const addEmergencyResourceBatch = useCallback(async (resourceId: string, input: EmergencyResourceBatchInput) => {
    if (hazardApiMode) { const resource = emergencyResourceRecords.find((item) => item.id === resourceId); if (!resource) throw new Error('应急资源不存在'); const updated = await addEmergencyResourceBatchByApi(resourceId, input, resource.version ?? 1); setEmergencyResourceRecords((items) => items.map((item) => item.id === resourceId ? updated : item)); return updated; }
    setDashboard((current) => current ? {
      ...current,
      emergencyResources: current.emergencyResources.map((resource) => resource.id === resourceId
        ? withAddedEmergencyResourceBatch(resource, input, `batch-${Date.now()}`)
        : resource),
    } : current);
  }, [emergencyResourceRecords]);

  const dispatchEmergencyResource = useCallback((
    resourceId: string,
    input: Omit<EmergencyResourceDispatchInput, 'id' | 'dispatchedAt'>,
  ) => {
    if (hazardApiMode) { const resource = emergencyResourceRecords.find((item) => item.id === resourceId); if (!resource) throw new Error('应急资源不存在'); return dispatchEmergencyResourceByApi(resourceId, input, resource.version ?? 1).then((updated) => { setEmergencyResourceRecords((items) => items.map((item) => item.id === resourceId ? updated : item)); return updated; }); }
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
  }, [emergencyResourceRecords]);

  const confirmEmergencyResourceArrival = useCallback(async (resourceId: string, dispatchId: string) => {
    if (hazardApiMode) { const resource = emergencyResourceRecords.find((item) => item.id === resourceId); if (!resource) throw new Error('应急资源不存在'); const updated = await confirmEmergencyResourceArrivalByApi(resourceId, dispatchId, resource.version ?? 1); setEmergencyResourceRecords((items) => items.map((item) => item.id === resourceId ? updated : item)); return updated; }
    setDashboard((current) => current ? {
      ...current,
      emergencyResources: current.emergencyResources.map((resource) => resource.id === resourceId
        ? withConfirmedResourceArrival(resource, dispatchId, getCurrentTimestamp())
        : resource),
    } : current);
  }, [emergencyResourceRecords]);

  const returnEmergencyResource = useCallback(async (resourceId: string, dispatchId: string) => {
    if (hazardApiMode) { const resource = emergencyResourceRecords.find((item) => item.id === resourceId); if (!resource) throw new Error('应急资源不存在'); const updated = await returnEmergencyResourceByApi(resourceId, dispatchId, resource.version ?? 1); setEmergencyResourceRecords((items) => items.map((item) => item.id === resourceId ? updated : item)); return updated; }
    setDashboard((current) => current ? {
      ...current,
      emergencyResources: current.emergencyResources.map((resource) => resource.id === resourceId
        ? withReturnedEmergencyResource(resource, dispatchId, getCurrentTimestamp())
        : resource),
    } : current);
  }, [emergencyResourceRecords]);

  const inspectEmergencyResource = useCallback((
    resourceId: string,
    input: Omit<EmergencyResourceInspectionInput, 'id' | 'inspectedAt'>,
  ) => {
    if (hazardApiMode) { const resource = emergencyResourceRecords.find((item) => item.id === resourceId); if (!resource) throw new Error('应急资源不存在'); return inspectEmergencyResourceByApi(resourceId, input, resource.version ?? 1).then((updated) => { setEmergencyResourceRecords((items) => items.map((item) => item.id === resourceId ? updated : item)); return updated; }); }
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
  }, [emergencyResourceRecords]);

  const saveEmergencyPlan = useCallback(async (planId: string | undefined, input: EmergencyPlanDraftInput) => {
    if (hazardApiMode) {
      const plan = emergencyPlanRecords.find((item) => item.id === planId);
      const updated = plan ? await updateEmergencyPlan(plan.id, input, plan.revision ?? 1) : await createEmergencyPlan(input);
      setEmergencyPlanRecords((items) => plan ? items.map((item) => item.id === plan.id ? updated : item) : [...items, updated]);
      return updated;
    }
    const localId = planId ?? `plan-custom-${Date.now()}`;
    setDashboard((current) => current ? {
      ...current,
      emergencyPlans: saveEmergencyPlanDraft(current.emergencyPlans, localId, input),
    } : current);
  }, [emergencyPlanRecords]);

  const submitEmergencyPlan = useCallback(async (planId: string) => {
    if (hazardApiMode) { const plan = emergencyPlanRecords.find((item) => item.id === planId); if (!plan) throw new Error('应急预案不存在'); const updated = await submitEmergencyPlanByApi(planId, plan.revision ?? 1); setEmergencyPlanRecords((items) => items.map((item) => item.id === planId ? updated : item)); return updated; }
    setDashboard((current) => current ? {
      ...current,
      emergencyPlans: current.emergencyPlans.map((plan) => plan.id === planId
        ? submitEmergencyPlanForReview(plan)
        : plan),
    } : current);
  }, [emergencyPlanRecords]);

  const approveEmergencyPlan = useCallback(async (planId: string) => {
    if (hazardApiMode) { const plan = emergencyPlanRecords.find((item) => item.id === planId); if (!plan) throw new Error('应急预案不存在'); const updated = await approveEmergencyPlanByApi(planId, plan.revision ?? 1); setEmergencyPlanRecords((items) => items.map((item) => item.id === planId ? updated : item)); return updated; }
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
  }, [emergencyPlanRecords]);

  const addEmergencyDrill = useCallback(async (planId: string, input: EmergencyDrillInput) => {
    if (hazardApiMode) { const plan = emergencyPlanRecords.find((item) => item.id === planId); if (!plan) throw new Error('应急预案不存在'); const updated = await addEmergencyDrillByApi(planId, input, plan.revision ?? 1); setEmergencyPlanRecords((items) => items.map((item) => item.id === planId ? updated : item)); return updated; }
    setDashboard((current) => current ? {
      ...current,
      emergencyPlans: current.emergencyPlans.map((plan) => plan.id === planId
        ? withAddedEmergencyDrill(plan, input, `drill-${Date.now()}`)
        : plan),
    } : current);
  }, [emergencyPlanRecords]);

  const startEmergencyDrill = useCallback(async (planId: string, drillId: string) => {
    if (hazardApiMode) { const plan = emergencyPlanRecords.find((item) => item.id === planId); if (!plan) throw new Error('应急预案不存在'); const updated = await startEmergencyDrillByApi(planId, drillId, plan.revision ?? 1); setEmergencyPlanRecords((items) => items.map((item) => item.id === planId ? updated : item)); return updated; }
    setDashboard((current) => current ? {
      ...current,
      emergencyPlans: current.emergencyPlans.map((plan) => plan.id === planId
        ? withStartedEmergencyDrill(plan, drillId, getCurrentTimestamp())
        : plan),
    } : current);
  }, [emergencyPlanRecords]);

  const recordEmergencyDrill = useCallback(async (planId: string, drillId: string, input: EmergencyDrillRecordInput) => {
    if (hazardApiMode) { const plan = emergencyPlanRecords.find((item) => item.id === planId); if (!plan) throw new Error('应急预案不存在'); const updated = await recordEmergencyDrillByApi(planId, drillId, input, plan.revision ?? 1); setEmergencyPlanRecords((items) => items.map((item) => item.id === planId ? updated : item)); return updated; }
    setDashboard((current) => current ? {
      ...current,
      emergencyPlans: current.emergencyPlans.map((plan) => plan.id === planId
        ? withRecordedEmergencyDrill(plan, drillId, input, getCurrentTimestamp())
        : plan),
    } : current);
  }, [emergencyPlanRecords]);

  const rollbackEmergencyPlanVersion = useCallback(async (planId: string, version: string) => {
    if (hazardApiMode) { const plan = emergencyPlanRecords.find((item) => item.id === planId); if (!plan) throw new Error('应急预案不存在'); const updated = await rollbackEmergencyPlanByApi(planId, version, plan.revision ?? 1); setEmergencyPlanRecords((items) => items.map((item) => item.id === planId ? updated : item)); return updated; }
    setDashboard((current) => current ? {
      ...current,
      emergencyPlans: current.emergencyPlans.map((plan) => plan.id === planId
        ? rollbackEmergencyPlan(plan, version)
        : plan),
    } : current);
  }, [emergencyPlanRecords]);

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

  const assessRiskUnit = useCallback(async (riskUnitId: string, input: RiskAssessmentInput) => {
    if (hazardApiMode) {
      const unit = dashboard?.riskUnits.find((item) => item.id === riskUnitId);
      if (!unit?.version) throw new Error('风险单元不存在或不支持服务端评估');
      const updated = await assessRiskUnitByApi(riskUnitId, input, unit.version);
      setDashboard((current) => current ? {
        ...current,
        riskUnits: current.riskUnits.map((item) => item.id === riskUnitId ? updated : item),
      } : current);
      return updated;
    }
    setDashboard((current) => current ? {
      ...current,
      riskUnits: current.riskUnits.map((unit) => unit.id === riskUnitId
        ? withAssessedRiskUnit(unit, input, `assessment-${Date.now()}`, getCurrentTimestamp())
        : unit),
    } : current);
    return undefined;
  }, [dashboard]);

  const saveRiskControls = useCallback(async (riskUnitId: string, controls: Array<Pick<RiskControlRecord, 'content' | 'owner' | 'status'>>) => {
    if (hazardApiMode) {
      const unit = dashboard?.riskUnits.find((item) => item.id === riskUnitId);
      if (!unit?.version) throw new Error('风险单元不存在或不支持服务端措施维护');
      const updated = await saveRiskControlsByApi(riskUnitId, controls, unit.version);
      setDashboard((current) => current ? {
        ...current,
        riskUnits: current.riskUnits.map((item) => item.id === riskUnitId ? updated : item),
      } : current);
      return updated;
    }
    setDashboard((current) => current ? {
      ...current,
      riskUnits: current.riskUnits.map((unit) => unit.id === riskUnitId
        ? withSavedRiskControls(unit, controls, getCurrentTimestamp())
        : unit),
    } : current);
    return undefined;
  }, [dashboard]);

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

  const triggerPermitLinkage = useCallback(async () => {
    if (hazardApiMode) {
      const { permits, signals } = await refreshWorkPermitLinkageRecords();
      return getWorkPermitLinkageSummary(permits, signals);
    }
    setDashboard((current) => current && isWarningScenarioEnabled(current, 'permit-linkage') ? {
      ...current,
      workPermits: applyPermitAlarmLinkage(current.workPermits, current.alarms),
    } : current);
    return undefined;
  }, [refreshWorkPermitLinkageRecords]);

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
    hazardApiMode,
    loadHazards,
    workPermits: hazardApiMode ? workPermitRecords : (dashboard?.workPermits ?? []),
    workPermitAreas: hazardApiMode ? workPermitAreas : (dashboard?.areas ?? []),
    workPermitGdsPoints: hazardApiMode ? gdsPointRecords : (dashboard?.gdsPoints ?? []),
    workPermitAlarms: hazardApiMode ? warningSignals : (dashboard?.alarms ?? []),
    workPermitLinkageAvailable: hazardApiMode
      ? isWorkPermitLinkageEnabled(warningRuleRecords)
      : true,
    workPermitApiMode: hazardApiMode,
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
    emergencyPlans: hazardApiMode ? emergencyPlanRecords : (dashboard?.emergencyPlans ?? []),
    emergencyPlanLoading: hazardApiMode ? emergencyPlanLoading : loading,
    emergencyPlanApiMode: hazardApiMode,
    loadEmergencyPlans,
    emergencyResources: hazardApiMode ? emergencyResourceRecords : (dashboard?.emergencyResources ?? []),
    emergencyResourceLoading: hazardApiMode ? emergencyResourceLoading : loading,
    emergencyResourceApiMode: hazardApiMode,
    loadEmergencyResources,
    communicationDispatches: communicationRecords,
    communicationTasks: hazardApiMode ? communicationRecords.flatMap((item) => item.tasks) : (dashboard?.communicationTasks ?? []),
    communicationLoading: hazardApiMode ? communicationLoading : loading,
    communicationApiMode: hazardApiMode,
    loadCommunications,
    gdsPoints: hazardApiMode ? gdsPointRecords : (dashboard?.gdsPoints ?? []),
    vocPoints: hazardApiMode ? vocPointRecords : (dashboard?.vocPoints ?? []),
    mesTags: hazardApiMode ? mesTagRecords : (dashboard?.mesTags ?? []),
    telemetryLoading: hazardApiMode ? telemetryLoading : loading,
    telemetryApiMode: hazardApiMode,
    telemetryRealtimeStatus: hazardApiMode ? telemetryRealtimeStatus : 'disabled',
    loadTelemetry,
    ingestTelemetrySample,
    simulateGdsAlarm,
    confirmAlarm,
    startEmergency,
    closeAlarm,
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
