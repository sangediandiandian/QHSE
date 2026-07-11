import type { DashboardData } from '@/types/qhse';
import { request } from '@umijs/max';

interface DashboardResponse {
  success: boolean;
  data: DashboardData;
}

export async function getDashboard() {
  return request<DashboardResponse>('/api/qhse/dashboard', {
    method: 'GET',
  });
}
