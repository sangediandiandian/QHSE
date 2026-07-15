import type { Attachment } from '@/types/qhse';
import { request } from '@umijs/max';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  requestId: string;
  timestamp: string;
}

export async function uploadAttachment(file: File, areaId: string) {
  const form = new FormData();
  form.append('file', file);
  form.append('areaId', areaId);
  const response = await request<ApiResponse<Attachment>>('/api/v1/attachments', {
    method: 'POST',
    data: form,
  });
  return response.data;
}

export async function downloadAttachment(id: string, filename: string) {
  const blob = await request<Blob>(`/api/v1/attachments/${id}/content`, {
    method: 'GET',
    responseType: 'blob',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
