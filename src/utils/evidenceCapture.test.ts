/** @jest-environment node */

import { cameraAccept, getCapturedEvidenceDefaults, getEvidenceCategory } from './evidenceCapture';

describe('mobile evidence capture', () => {
  test('生成可追溯的现场照片名称和 UTC 拍摄时间', () => {
    expect(
      getCapturedEvidenceDefaults({ name: 'camera.PNG' }, new Date('2026-07-20T09:30:45.000Z')),
    ).toEqual({
      name: '现场照片-20260720-093045.png',
      note: '移动端现场拍摄；拍摄时间：2026-07-20T09:30:45.000Z',
    });
  });

  test('限制相机入口为服务端支持的图片类型并按状态推荐证据阶段', () => {
    expect(cameraAccept).toBe('image/jpeg,image/png,image/webp');
    expect(getEvidenceCategory('待整改')).toBe('整改前');
    expect(getEvidenceCategory('整改中')).toBe('整改过程');
    expect(getEvidenceCategory('待验收')).toBe('整改完成');
  });
});
