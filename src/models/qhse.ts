import { getDashboard } from '@/services/qhse/dashboard';
import type { DashboardData } from '@/types/qhse';
import { withSimulatedGdsAlarm } from '@/utils/dashboardScenario';
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

  return { dashboard, loading, loadDashboard, simulateGdsAlarm };
}
