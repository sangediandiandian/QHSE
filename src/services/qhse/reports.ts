import type { ReportExportJob, ReportSummary } from '@/types/qhse';
import { request } from '@umijs/max';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  requestId: string;
  timestamp: string;
}

export interface ReportQuery {
  from: string;
  to: string;
  areaId?: string;
}

export async function getReportSummary(params: ReportQuery) {
  const response = await request<ApiResponse<ReportSummary>>('/api/v1/reports/summary', {
    method: 'GET',
    params,
  });
  return response.data;
}

export async function exportReport(params: ReportQuery) {
  const blob = await request<Blob>('/api/v1/reports/summary/export', {
    method: 'GET',
    params,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `QHSE统计报表_${params.from}_${params.to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function createReportExport(params: ReportQuery) {
  const response = await request<ApiResponse<ReportExportJob>>('/api/v1/reports/exports', {
    method: 'POST',
    data: params,
  });
  return response.data;
}

export async function getReportExport(id: string) {
  const response = await request<ApiResponse<ReportExportJob>>(`/api/v1/reports/exports/${id}`, {
    method: 'GET',
  });
  return response.data;
}

export async function downloadReportExport(job: ReportExportJob) {
  const blob = await request<Blob>(`/api/v1/reports/exports/${job.id}/content`, {
    method: 'GET',
    responseType: 'blob',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = job.filename || 'QHSE统计报表.csv';
  link.click();
  URL.revokeObjectURL(url);
}
