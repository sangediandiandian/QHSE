import { getDashboard } from '@/services/qhse/dashboard';
import type {
  DashboardData,
  EmergencyEventAction,
  EmergencyPlanDraftInput,
  EmergencyResourceDispatchInput,
  EmergencyResourceInput,
  EmergencyResourceInspectionInput,
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
import { applyPermitAlarmLinkage, nextHazardStatus, nextPermitStatus } from '@/utils/managementWorkflow';
import {
  clearPersistedDashboard,
  loadPersistedDashboard,
  persistDashboard,
} from '@/utils/dashboardPersistence';
import { isWarningScenarioEnabled, withWarningRuleTriggered } from '@/utils/warningRules';
import { transitionEmergencyEvent } from '@/utils/emergencyEventWorkflow';
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
      const transitioned = transitionEmergencyEvent(event, action, operator, operatedAt);
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

  const advanceHazard = useCallback((hazardId: string) => {
    setDashboard((current) => current ? {
      ...current,
      hazards: current.hazards.map((hazard) => hazard.id === hazardId ? {
        ...hazard,
        status: nextHazardStatus(hazard.status),
        overdue: nextHazardStatus(hazard.status) === '已关闭' ? false : hazard.overdue,
      } : hazard),
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
      warningRules: current.warningRules.map((rule) => rule.id === ruleId
        ? withPublishedWarningRule(
          rule,
          new Date().toLocaleString('zh-CN', { hour12: false }),
          '赵磊 / QHSE 管理部',
        )
        : rule),
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
    advanceHazard,
    triggerPermitLinkage,
    advanceWorkPermit,
    toggleWarningRule,
    saveWarningRule,
    submitWarningRule,
    approveWarningRule,
    rollbackWarningRuleVersion,
    resetDashboard,
  };
}
