import type { Hazard } from '@/types/qhse';
import { acceptAndCloseHazard, addHazardEvidence, createHazard, startHazardRectification, submitHazardAcceptance, toggleHazardSupervision } from './hazardWorkflow';

const input = { title: '静电接地夹磨损', areaId: 'area-1', areaName: '装卸区', level: '较大' as const, source: '现场检查' as const, category: '电气安全', ownerDepartment: '储运部', owner: '宋伟', discoveredAt: '2026-07-14', deadline: '2026-07-15', riskUnitId: 'risk-1', description: '夹齿磨损', measures: ['更换接地夹'] };

describe('hazardWorkflow', () => {
  test('上报隐患生成整改任务与操作记录', () => {
    const hazard = createHazard(input, 'hazard-1', 'YH001', '赵磊', '2026-07-14 09:00:00');
    expect(hazard).toMatchObject({ status: '待整改', supervised: false });
    expect(hazard.operations?.[0].action).toBe('上报');
  });

  test('无整改证据不能提交验收', () => {
    const hazard = startHazardRectification(createHazard(input, 'hazard-1', 'YH001', '赵磊', 'now'), '宋伟', 'later');
    expect(() => submitHazardAcceptance(hazard, '宋伟', 'later')).toThrow('至少添加一项整改证据');
  });

  test('证据、验收和关闭形成完整闭环', () => {
    let hazard: Hazard = startHazardRectification(createHazard(input, 'hazard-1', 'YH001', '赵磊', 'now'), '宋伟', 'later');
    hazard = addHazardEvidence(hazard, { name: '整改照片.jpg', category: '整改完成', uploader: '宋伟', note: '接地夹已更换' }, 'evidence-1', '2026-07-14 10:00:00');
    hazard = submitHazardAcceptance(hazard, '宋伟', '2026-07-14 10:01:00');
    hazard = acceptAndCloseHazard(hazard, '现场复核合格', '赵磊', '2026-07-14 10:10:00');
    expect(hazard).toMatchObject({ status: '已关闭', acceptanceOpinion: '现场复核合格' });
    expect(hazard.operations?.map((item) => item.action)).toEqual(['上报', '开始整改', '提交验收', '验收关闭']);
  });

  test('挂牌督办可切换并留痕', () => {
    const hazard = createHazard(input, 'hazard-1', 'YH001', '赵磊', 'now');
    expect(toggleHazardSupervision(hazard, '赵磊', 'later').supervised).toBe(true);
  });
});
