import type { HazardEvidence } from '@/types/qhse';

export const cameraImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
export const cameraAccept = cameraImageTypes.join(',');

export function getEvidenceCategory(status: string): HazardEvidence['category'] {
  if (status === '待整改') return '整改前';
  if (status === '整改中') return '整改过程';
  return '整改完成';
}

export function getCapturedEvidenceDefaults(file: Pick<File, 'name'>, capturedAt: Date) {
  const extension = file.name.match(/\.[a-z0-9]{1,10}$/i)?.[0]?.toLowerCase() ?? '.jpg';
  const timestamp = capturedAt.toISOString();
  const compact = timestamp
    .slice(0, 19)
    .replace(/[-:T]/g, '')
    .replace(/^(\d{8})(\d{6})$/, '$1-$2');
  return {
    name: `现场照片-${compact}${extension}`,
    note: `移动端现场拍摄；拍摄时间：${timestamp}`,
  };
}
