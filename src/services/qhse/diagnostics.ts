import type { SystemDiagnostics } from '@/types/qhse';
import { request } from '@umijs/max';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  requestId: string;
  timestamp: string;
}

export async function getSystemDiagnostics() {
  const response = await request<ApiResponse<SystemDiagnostics>>('/api/v1/system/diagnostics', {
    method: 'GET',
  });
  return response.data;
}
