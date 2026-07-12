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
  };
}
