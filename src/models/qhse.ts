import { getDashboard } from '@/services/qhse/dashboard';
import type { DashboardData, EmergencyEventAction } from '@/types/qhse';
import {
  withAlarmStatus,
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
import { useCallback, useEffect, useState } from 'react';

function getBrowserStorage() {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
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
    setDashboard((current) => (current ? withAlarmStatus(current, eventId, '已确认') : current));
  }, []);

  const startEmergency = useCallback((eventId: string) => {
    setDashboard((current) => (current ? withAlarmStatus(current, eventId, '处置中') : current));
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

  const advanceEmergencyResource = useCallback((resourceId: string) => {
    setDashboard((current) => current ? {
      ...current,
      emergencyResources: current.emergencyResources.map((resource) => resource.id === resourceId ? {
        ...resource,
        status: resource.status === '待命' ? '调度中' : resource.status === '调度中' ? '已到位' : resource.status,
        eta: resource.status === '调度中' ? '已到场' : resource.eta,
      } : resource),
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
        ? { ...rule, enabled: !rule.enabled }
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
    simulateVocAlarm,
    simulateJointAlarm,
    advanceCommunication,
    confirmCommunication,
    advanceEmergencyTask,
    advanceEmergencyResource,
    advanceReviewAction,
    closeEventReview,
    transitionEvent,
    advanceHazard,
    triggerPermitLinkage,
    advanceWorkPermit,
    toggleWarningRule,
    resetDashboard,
  };
}
