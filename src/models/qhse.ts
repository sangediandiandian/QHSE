import { getDashboard } from '@/services/qhse/dashboard';
import type { DashboardData } from '@/types/qhse';
import {
  withAlarmStatus,
  withCommunicationConfirmation,
  withCommunicationEscalation,
  withSimulatedGdsAlarm,
  withSimulatedJointAlarm,
  withSimulatedVocAlarm,
} from '@/utils/dashboardScenario';
import { applyPermitAlarmLinkage, nextHazardStatus, nextPermitStatus } from '@/utils/managementWorkflow';
import { useCallback, useState } from 'react';

export default function useQhseModel() {
  const [dashboard, setDashboard] = useState<DashboardData>();
  const [loading, setLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getDashboard();
      setDashboard(response.data);
    } finally {
      setLoading(false);
    }
  }, []);

  const simulateGdsAlarm = useCallback(() => {
    setDashboard((current) => {
      if (!current) return current;
      const occurredAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      return withSimulatedGdsAlarm(
        current,
        occurredAt,
        new Date().toLocaleString('zh-CN', { hour12: false }),
      );
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
      return withSimulatedVocAlarm(
        current,
        new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        new Date().toLocaleString('zh-CN', { hour12: false }),
      );
    });
  }, []);

  const simulateJointAlarm = useCallback(() => {
    setDashboard((current) => current ? withSimulatedJointAlarm(
      current,
      new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      new Date().toLocaleString('zh-CN', { hour12: false }),
    ) : current);
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
    setDashboard((current) => current ? {
      ...current,
      workPermits: applyPermitAlarmLinkage(current.workPermits, current.alarms),
    } : current);
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
    advanceHazard,
    triggerPermitLinkage,
    advanceWorkPermit,
  };
}
