import type {
  DashboardData,
  CommunicationTask,
  EmergencyEvent,
  EmergencyResource,
  EmergencyTask,
  EmergencyPlanTemplate,
  EventReview,
  GdsPoint,
  Hazard,
  MesTag,
  MesUnit,
  RiskUnit,
  VocFacility,
  VocPoint,
  WarningRule,
  WorkPermit,
} from '../src/types/qhse';

const areaCatalog = [
  ['area-01', '常减压装置', 'CDU'],
  ['area-02', '催化裂化装置', 'FCC'],
  ['area-03', '加氢装置', 'HCU'],
  ['area-04', '硫磺回收装置', 'SRU'],
  ['area-05', '储罐区', 'TANK'],
  ['area-06', '油品装卸区', 'LOAD'],
] as const;

const gdsPoints: GdsPoint[] = Array.from({ length: 30 }, (_, index) => {
  const number = index + 1;
  const [areaId, areaName, areaCode] = areaCatalog[index % areaCatalog.length];
  const code = number === 1 ? 'GDS-101' : `GDS-${areaCode}-${String(number).padStart(2, '0')}`;
  const offline = number === 12 || number === 24;
  const fault = number === 18;
  const level2 = number === 8 || number === 20;
  const level1 = number === 5 || number === 14 || number === 27;
  const rising = number === 2 || number === 23;
  const currentValue = level2 ? 45 + (number % 4) : level1 ? 28 + (number % 5) : rising ? 24 : 4 + (number % 9);
  return {
    id: number === 1 ? 'gds-101' : `gds-${number}`,
    code,
    name: `${areaName}${number % 2 ? '泵区' : '管廊'}探测器`,
    areaId,
    areaName,
    equipmentName: number % 2 ? `P-${100 + number} 机泵` : `PL-${200 + number} 管线`,
    gasType: number % 10 === 0 ? '硫化氢' : number % 13 === 0 ? '氧气' : '可燃气体',
    currentValue,
    unit: number % 10 === 0 ? 'ppm' : number % 13 === 0 ? '%VOL' : '%LEL',
    alarmLevel1: number % 10 === 0 ? 10 : number % 13 === 0 ? 19.5 : 25,
    alarmLevel2: number % 10 === 0 ? 20 : number % 13 === 0 ? 23.5 : 40,
    onlineStatus: offline ? 'offline' : fault ? 'fault' : 'online',
    alarmStatus: level2 ? 'level2' : level1 ? 'level1' : rising ? 'trend' : 'normal',
    trend: [7, 8, 9, 11, 13, currentValue].map((value) => Math.max(0, value + (number % 3) - 1)),
  };
});

const vocFacilities: VocFacility[] = [
  {
    id: 'facility-rto-01', code: 'RTO-01', name: '一号蓄热式氧化炉', processType: 'RTO',
    areaName: '硫磺回收装置', inletValue: 286, outletValue: 38, efficiency: 86.7,
    temperature: 782, fanStatus: '运行', valveStatus: '开启', status: 'normal',
  },
  {
    id: 'facility-rco-01', code: 'RCO-01', name: '催化氧化处理设施', processType: 'RCO',
    areaName: '油品装卸区', inletValue: 192, outletValue: 31, efficiency: 83.9,
    temperature: 348, fanStatus: '运行', valveStatus: '开启', status: 'normal',
  },
];

const vocPoints: VocPoint[] = [
  ['voc-stack-01', 'VOC-EX-01', 'RTO 一号排口', '有组织排口', 'area-04', '硫磺回收装置', 38, 60, 18500, 'facility-rto-01'],
  ['voc-stack-02', 'VOC-EX-02', 'RCO 二号排口', '有组织排口', 'area-06', '油品装卸区', 31, 60, 12600, 'facility-rco-01'],
  ['voc-stack-03', 'VOC-EX-03', '储罐呼吸气排口', '有组织排口', 'area-05', '储罐区', 44, 60, 8300, undefined],
  ['voc-stack-04', 'VOC-EX-04', '污水处理废气排口', '有组织排口', 'area-04', '硫磺回收装置', 52, 60, 9700, undefined],
  ['voc-boundary-01', 'VOC-BD-01', '东厂界监测点', '厂界监测点', 'area-06', '油品装卸区', 2.1, 4, 0, undefined],
  ['voc-boundary-02', 'VOC-BD-02', '南厂界监测点', '厂界监测点', 'area-05', '储罐区', 1.8, 4, 0, undefined],
  ['voc-boundary-03', 'VOC-BD-03', '西厂界监测点', '厂界监测点', 'area-01', '常减压装置', 2.6, 4, 0, undefined],
  ['voc-boundary-04', 'VOC-BD-04', '北厂界监测点', '厂界监测点', 'area-03', '加氢装置', 0, 4, 0, undefined],
].map(([id, code, name, pointType, areaId, areaName, value, limit, flow, facilityId], index) => ({
  id: String(id), code: String(code), name: String(name), pointType: pointType as VocPoint['pointType'],
  areaId: String(areaId), areaName: String(areaName), pollutantType: '非甲烷总烃',
  currentValue: Number(value), limitValue: Number(limit), flowValue: Number(flow),
  facilityId: facilityId ? String(facilityId) : undefined,
  status: index === 7 ? 'offline' : Number(value) / Number(limit) > 0.8 ? 'warning' : 'normal',
  trend: [0.58, 0.65, 0.62, 0.7, 0.76, 1].map((factor) => Math.round(Number(value) * factor * 10) / 10),
}));

const mesUnits: MesUnit[] = [
  { id: 'mes-unit-01', code: 'CDU', name: '常减压装置', load: 86, operatingMode: '稳定运行', status: 'normal' },
  { id: 'mes-unit-02', code: 'FCC', name: '催化裂化装置', load: 91, operatingMode: '高负荷运行', status: 'warning' },
  { id: 'mes-unit-03', code: 'HCU', name: '加氢装置', load: 78, operatingMode: '稳定运行', status: 'normal' },
  { id: 'mes-unit-04', code: 'SRU', name: '硫磺回收装置', load: 72, operatingMode: '稳定运行', status: 'normal' },
];

const mesTagSeeds: Array<[string, string, string, MesTag['processStep'], MesTag['parameterType'], number, string, number, number]> = [
  ['mes-pt-101', 'PT-101', '进料泵出口压力', '进料', '压力', 2.18, 'MPa', 2.4, 1.6],
  ['mes-ft-101', 'FT-101', '原油进料流量', '进料', '流量', 102, 't/h', 118, 82],
  ['mes-lt-101', 'LT-101', '电脱盐罐液位', '进料', '液位', 58, '%', 75, 35],
  ['mes-tt-201', 'TT-201', '加热炉出口温度', '加热', '温度', 356, '℃', 375, 330],
  ['mes-pt-201', 'PT-201', '加热炉炉膛压力', '加热', '压力', -0.12, 'kPa', 0, -0.3],
  ['mes-ft-201', 'FT-201', '燃料气流量', '加热', '流量', 860, 'Nm³/h', 980, 650],
  ['mes-tt-301', 'TT-301', '常压塔顶温度', '分馏', '温度', 126, '℃', 140, 110],
  ['mes-pt-301', 'PT-301', '常压塔顶压力', '分馏', '压力', 0.18, 'MPa', 0.22, 0.12],
  ['mes-lt-301', 'LT-301', '常压塔底液位', '分馏', '液位', 61, '%', 78, 38],
  ['mes-tt-302', 'TT-302', '减压塔顶温度', '分馏', '温度', 88, '℃', 105, 72],
  ['mes-pt-302', 'PT-302', '减压塔真空度', '分馏', '压力', -92, 'kPa', -85, -98],
  ['mes-ft-401', 'FT-401', '石脑油外送流量', '外送', '流量', 32, 't/h', 42, 22],
  ['mes-ft-402', 'FT-402', '柴油外送流量', '外送', '流量', 46, 't/h', 58, 30],
  ['mes-pt-401', 'PT-401', '外送泵出口压力', '外送', '压力', 1.86, 'MPa', 2.2, 1.4],
  ['mes-lt-401', 'LT-401', '产品缓冲罐液位', '外送', '液位', 52, '%', 80, 30],
  ['mes-load-01', 'LOAD-CDU', '装置运行负荷', '外送', '负荷', 86, '%', 95, 55],
];

const mesTags: MesTag[] = mesTagSeeds.map(([id, code, name, processStep, parameterType, value, unit, upper, lower]) => ({
  id, code, name, unitId: 'mes-unit-01', unitName: '常减压装置',
  equipmentName: {
    进料: 'P-101 进料泵', 加热: 'F-201 加热炉',
    分馏: 'T-301 分馏塔', 外送: 'P-401 外送泵',
  }[processStep],
  processStep, parameterType, currentValue: value, unit, upperLimit: upper, lowerLimit: lower,
  status: id === 'mes-pt-302' ? 'warning' : 'normal',
  trend: [0.96, 0.98, 0.97, 1.01, 1, 1].map((factor) => Math.round(value * factor * 100) / 100),
}));

const communicationTasks: CommunicationTask[] = [
  {
    id: 'comm-001', eventId: 'evt-001', eventTitle: '可燃气体浓度持续上升',
    receiver: '王强', receiverRole: '岗位操作员', channel: 'App消息', sendTime: '08:28:45',
    deliveryStatus: '已送达', confirmStatus: '未确认', retryCount: 0, escalationLevel: 0,
  },
  {
    id: 'comm-002', eventId: 'evt-002', eventTitle: 'RTO 出口浓度接近限值',
    receiver: '周敏', receiverRole: '环保管理人员', channel: 'App消息', sendTime: '08:19:10',
    deliveryStatus: '已送达', confirmStatus: '已确认', confirmTime: '08:19:42', retryCount: 0, escalationLevel: 0,
  },
  {
    id: 'comm-003', eventId: 'evt-003', eventTitle: '泵出口压力偏高',
    receiver: '陈涛', receiverRole: '生产调度', channel: '短信', sendTime: '08:11:40',
    deliveryStatus: '已送达', confirmStatus: '已确认', confirmTime: '08:12:08', retryCount: 0, escalationLevel: 0,
  },
];

const emergencyTasks: EmergencyTask[] = [
  { id: 'task-001', eventId: 'evt-001', name: '现场确认与气体复测', department: '催化裂化装置', owner: '王强', deadline: '2分钟', status: '已完成', feedback: '确认泵区东侧可燃气体浓度升高' },
  { id: 'task-002', eventId: 'evt-001', name: '人员撤离至北侧集合点', department: '生产运行部', owner: '李建国', deadline: '5分钟', status: '执行中' },
  { id: 'task-003', eventId: 'evt-001', name: '设置100米警戒区域', department: '安全环保部', owner: '赵磊', deadline: '5分钟', status: '执行中' },
  { id: 'task-004', eventId: 'evt-001', name: '切断上游物料并降负荷', department: '生产调度', owner: '陈涛', deadline: '8分钟', status: '待执行' },
  { id: 'task-005', eventId: 'evt-001', name: '消防与气防力量现场待命', department: '消防气防中心', owner: '张伟', deadline: '8分钟', status: '待执行' },
];

const emergencyResources: EmergencyResource[] = [
  { id: 'res-001', code: 'FIRE-TRUCK-01', name: '泡沫消防车', type: '消防', quantity: '2 辆', totalQuantity: 2, availableQuantity: 1, unit: '辆', location: '消防站', eta: '3 分钟', status: '调度中', owner: '张伟', contact: '6001', lastInspection: '2026-07-01', nextInspection: '2026-08-01', inspectionStatus: '检查合格', dispatches: [{ id: 'dispatch-001', eventName: 'FCC 泵区可燃气体泄漏', destination: 'FCC 泵区东侧', quantity: 1, operator: '陈涛', dispatchedAt: '2026-07-13 08:31:20', originalEta: '3 分钟', status: '调度中' }], inspectionRecords: [] },
  { id: 'res-002', code: 'SCBA-FCC-01', name: '正压式空气呼吸器', type: '气防', quantity: '12 套', totalQuantity: 12, availableQuantity: 8, unit: '套', location: 'FCC 气防柜', eta: '已到场', status: '已到位', owner: '刘洋', contact: '6218', lastInspection: '2026-07-08', nextInspection: '2026-08-08', inspectionStatus: '检查合格', dispatches: [{ id: 'dispatch-002', eventName: 'FCC 泵区可燃气体泄漏', destination: 'FCC 泵区东侧', quantity: 4, operator: '陈涛', dispatchedAt: '2026-07-13 08:29:10', arrivedAt: '2026-07-13 08:33:42', originalEta: '5 分钟', status: '已到位' }], inspectionRecords: [] },
  { id: 'res-003', code: 'MED-AED-01', name: '急救担架与 AED', type: '医疗', quantity: '2 组', totalQuantity: 2, availableQuantity: 2, unit: '组', location: '厂区医务室', eta: '6 分钟', status: '待命', owner: '林晓', contact: '6120', lastInspection: '2026-06-26', nextInspection: '2026-07-18', inspectionStatus: '即将到期', dispatches: [], inspectionRecords: [] },
  { id: 'res-004', code: 'LEAK-KIT-01', name: '防爆警戒与堵漏工具', type: '物资', quantity: '1 批', totalQuantity: 1, availableQuantity: 0, unit: '批', location: '应急物资库', eta: '5 分钟', status: '调度中', owner: '赵磊', contact: '6058', lastInspection: '2026-07-05', nextInspection: '2026-08-05', inspectionStatus: '检查合格', dispatches: [{ id: 'dispatch-003', eventName: 'FCC 泵区可燃气体泄漏', destination: 'FCC 泵区东侧', quantity: 1, operator: '陈涛', dispatchedAt: '2026-07-13 08:32:05', originalEta: '5 分钟', status: '调度中' }], inspectionRecords: [] },
  { id: 'res-005', code: 'FIRE-ROBOT-01', name: '防爆消防机器人', type: '消防', quantity: '1 台', totalQuantity: 1, availableQuantity: 1, unit: '台', location: '消防站二库', eta: '8 分钟', status: '待命', owner: '张伟', contact: '6001', lastInspection: '2026-06-18', nextInspection: '2026-07-10', inspectionStatus: '需要维护', dispatches: [], inspectionRecords: [{ id: 'inspection-001', inspector: '张伟', inspectedAt: '2026-06-18 15:20:00', result: '需要维护', nextInspection: '2026-07-10', note: '动力系统启动异常，等待维修' }] },
  { id: 'res-006', code: 'GAS-MOBILE-02', name: '移动式气体检测组', type: '气防', quantity: '6 台', totalQuantity: 6, availableQuantity: 6, unit: '台', location: '中央控制室', eta: '4 分钟', status: '待命', owner: '刘洋', contact: '6218', lastInspection: '2026-07-09', nextInspection: '2026-08-09', inspectionStatus: '检查合格', dispatches: [], inspectionRecords: [] },
  { id: 'res-007', code: 'MED-AMB-01', name: '厂区救护车', type: '医疗', quantity: '1 辆', totalQuantity: 1, availableQuantity: 1, unit: '辆', location: '厂区医务室', eta: '5 分钟', status: '待命', owner: '林晓', contact: '6120', lastInspection: '2026-07-02', nextInspection: '2026-08-02', inspectionStatus: '检查合格', dispatches: [], inspectionRecords: [] },
  { id: 'res-008', code: 'BOOM-ABS-01', name: '围油栏与吸附材料', type: '物资', quantity: '3 套', totalQuantity: 3, availableQuantity: 3, unit: '套', location: '储运应急库', eta: '10 分钟', status: '待命', owner: '周敏', contact: '6077', lastInspection: '2026-06-30', nextInspection: '2026-07-30', inspectionStatus: '检查合格', dispatches: [], inspectionRecords: [] },
];

const emergencyPlanSeeds: Array<Omit<EmergencyPlanTemplate, 'status' | 'publishStatus' | 'draft' | 'versions' | 'expiryDate'> & { status: '生效中' | '待评审' }> = [
  { id: 'tpl-001', code: 'QHSE-FCC-LEAK-01', name: '可燃气体泄漏现场处置方案', category: '现场处置方案', eventType: '可燃气体泄漏', applicableArea: '催化裂化装置', medium: '烃类可燃气体', responseLevel: 'II级', triggerRule: 'GDS 达到二级报警或多点浓度持续上升', notificationTargets: ['岗位人员', '装置负责人', '生产调度', '消防气防'], steps: ['停止作业并撤离现场', '切断物料与火源', '设置警戒并持续监测', '组织堵漏与恢复评估'], resources: ['泡沫消防车', '空气呼吸器', '防爆堵漏工具'], version: 'V3.2', effectiveDate: '2026-05-01', status: '生效中', ownerDepartment: '催化裂化装置' },
  { id: 'tpl-002', code: 'QHSE-GAS-H2S-02', name: '硫化氢泄漏专项应急预案', category: '专项应急预案', eventType: '有毒气体泄漏', applicableArea: '全厂含硫装置', medium: '硫化氢', responseLevel: 'I级', triggerRule: 'H₂S 浓度达到 20ppm 或出现人员中毒', notificationTargets: ['应急指挥人员', '消防气防', '医疗救护', '属地负责人'], steps: ['佩戴正压式呼吸器', '上风向组织撤离', '搜救受影响人员', '隔离泄漏源并通风'], resources: ['气防车', '空气呼吸器', '急救担架', '便携式检测仪'], version: 'V2.6', effectiveDate: '2026-03-15', status: '生效中', ownerDepartment: '安全环保部' },
  { id: 'tpl-003', code: 'QHSE-ENV-VOC-03', name: 'VOC 异常排放专项处置预案', category: '专项应急预案', eventType: '环境污染事件', applicableArea: 'VOC 治理设施及排口', medium: '非甲烷总烃', responseLevel: 'III级', triggerRule: '排口连续 10 分钟超限或治理效率低于 80%', notificationTargets: ['环保管理人员', '装置负责人', '生产调度'], steps: ['核查在线数据与设备状态', '切换备用治理设施', '降低相关装置负荷', '开展厂界加密监测'], resources: ['便携式 VOC 分析仪', '移动治理设备'], version: 'V2.1', effectiveDate: '2026-04-20', status: '生效中', ownerDepartment: '安全环保部' },
  { id: 'tpl-004', code: 'QHSE-TANK-FIRE-01', name: '储罐火灾爆炸专项应急预案', category: '专项应急预案', eventType: '火灾爆炸', applicableArea: '储罐区', medium: '油品及化学品', responseLevel: 'I级', triggerRule: '储罐明火、温度突升或可燃气体多点报警', notificationTargets: ['企业应急指挥部', '消防气防', '生产调度', '医疗救护'], steps: ['启动固定消防设施', '切断进出料并冷却相邻罐', '扩大警戒和人员疏散', '实施泡沫灭火'], resources: ['大流量泡沫车', '消防机器人', '移动水炮'], version: 'V4.0', effectiveDate: '2026-06-01', status: '生效中', ownerDepartment: '储运部' },
  { id: 'tpl-005', code: 'QHSE-GEN-2026', name: '生产安全事故综合应急预案', category: '综合应急预案', eventType: '综合事故', applicableArea: '全厂', medium: '多介质', responseLevel: 'I级', triggerRule: '重大事故或多个专项预案协同启动', notificationTargets: ['企业应急指挥部', '各专业应急组', '属地政府联络人'], steps: ['成立现场指挥部', '启动专业应急组', '统一资源和信息发布', '组织恢复与事故调查'], resources: ['指挥通信车', '全厂应急资源清单'], version: 'V5.1', effectiveDate: '2026-01-01', status: '生效中', ownerDepartment: 'QHSE 管理部' },
  { id: 'tpl-006', code: 'CARD-CDU-PUMP-07', name: '常减压泵区泄漏岗位处置卡', category: '岗位应急处置卡', eventType: '管线及设备泄漏', applicableArea: '常减压装置泵区', medium: '原油及成品油', responseLevel: 'IV级', triggerRule: '现场发现滴漏、异味或单点低限报警', notificationTargets: ['岗位班长', '装置值班人员'], steps: ['按下紧急停泵按钮', '关闭进出口阀门', '报告班长并设置临时警戒', '使用吸附材料控制扩散'], resources: ['吸油毡', '便携式检测仪', '防爆工具'], version: 'V1.4', effectiveDate: '2025-11-10', status: '待评审', ownerDepartment: '常减压装置' },
];

const planExpiryDates: Record<string, string> = {
  'tpl-001': '2026-08-15',
  'tpl-002': '2027-03-14',
  'tpl-003': '2027-04-19',
  'tpl-004': '2027-05-31',
  'tpl-005': '2026-12-31',
  'tpl-006': '2026-11-09',
};

const emergencyPlans: EmergencyPlanTemplate[] = emergencyPlanSeeds.map((plan) => {
  const config = {
    name: plan.name,
    category: plan.category,
    eventType: plan.eventType,
    applicableArea: plan.applicableArea,
    medium: plan.medium,
    responseLevel: plan.responseLevel,
    triggerRule: plan.triggerRule,
    notificationTargets: plan.notificationTargets,
    steps: plan.steps,
    resources: plan.resources,
    effectiveDate: plan.effectiveDate,
    expiryDate: planExpiryDates[plan.id],
    ownerDepartment: plan.ownerDepartment,
  };
  const pending = plan.status === '待评审';
  return {
    ...plan,
    ...config,
    status: pending ? '已停用' : '生效中',
    publishStatus: pending ? '待评审' : '已发布',
    draft: pending ? config : undefined,
    versions: pending ? [] : [{
      ...config,
      version: plan.version,
      publishedAt: `${plan.effectiveDate} 09:00:00`,
      publisher: '赵磊 / QHSE 管理部',
    }],
  };
});

const eventReviews: EventReview[] = [
  {
    id: 'review-001', eventId: 'evt-001', reviewCode: 'RP20260711001', status: '待关闭', reviewer: '赵磊 / QHSE 管理部',
    summary: 'FCC 泵区可燃气体浓度持续上升，现场人员按预案完成撤离、警戒和物料切断，泄漏点已隔离，连续监测 30 分钟数据恢复正常。',
    directCause: 'P-208 泵出口法兰垫片失效，少量介质泄漏后形成可燃气体聚集。',
    rootCause: '高温循环工况下垫片选型裕量不足，设备完整性检查清单未覆盖法兰热循环后的专项复紧要求。',
    lesson: '将高温泵法兰纳入关键泄漏点分级管理，强化材料选型复核和开停车后的专项检查。',
    controlledAt: '2026-07-11 08:47:32',
    timeline: [
      { time: '08:28:42', title: 'GDS 二级报警', detail: 'GDS-101 检测值升至 38%LEL', status: 'done' },
      { time: '08:29:03', title: '事件确认', detail: '岗位人员确认现场存在异常气味', status: 'done' },
      { time: '08:30:18', title: '启动 II 级响应', detail: '自动匹配并启动可燃气体泄漏处置方案', status: 'done' },
      { time: '08:34:50', title: '人员撤离完成', detail: '32 人完成清点，警戒区域设置完成', status: 'done' },
      { time: '08:39:26', title: '泄漏源隔离', detail: '切断 P-208 上游物料并降负荷', status: 'done' },
      { time: '08:47:32', title: '风险受控', detail: '现场浓度降至 8%LEL 并持续下降', status: 'active' },
      { time: '--', title: '事件关闭', detail: '等待整改措施完成和关闭审批', status: 'pending' },
    ],
    actions: [
      { id: 'action-001', title: '更换 P-208 法兰垫片并完成气密试验', ownerDepartment: '催化裂化装置', owner: '李建国', deadline: '2026-07-12', priority: '紧急', status: '已完成' },
      { id: 'action-002', title: '复核同类高温泵法兰垫片选型', ownerDepartment: '设备管理部', owner: '孙工', deadline: '2026-07-15', priority: '重要', status: '整改中' },
      { id: 'action-003', title: '修订开停车后法兰专项检查清单', ownerDepartment: '生产运行部', owner: '陈涛', deadline: '2026-07-18', priority: '重要', status: '待整改' },
      { id: 'action-004', title: '组织泄漏事件班组复盘培训', ownerDepartment: 'QHSE 管理部', owner: '赵磊', deadline: '2026-07-20', priority: '一般', status: '待整改' },
    ],
  },
];

const riskUnits: RiskUnit[] = [
  {
    id: 'risk-001', code: 'RU-FCC-P208', name: 'P-208 高温油泵单元', parentName: '反应油气系统',
    areaId: 'area-02', areaName: '催化裂化装置', ownerDepartment: '催化裂化装置', owner: '李建国',
    medium: '高温油气、可燃气体', accidentTypes: ['泄漏', '火灾爆炸'], staticLevel: 'high', currentLevel: 'critical',
    controls: ['双端面机械密封与泄漏收集', '泵区 GDS 连续监测', '高温法兰每班巡检', '动火作业与预警自动联锁提醒'],
    linkedGds: 4, linkedVoc: 0, linkedMes: 6, linkedPlans: 2,
    dynamicFactors: [
      { source: 'GDS', label: 'GDS-101 浓度持续上升', impact: 'up', status: '38% LEL' },
      { source: '作业许可', label: '泵出口法兰一级动火', impact: 'up', status: '作业中' },
      { source: '隐患', label: '同类法兰垫片复核未完成', impact: 'watch', status: '整改中' },
    ],
  },
  {
    id: 'risk-002', code: 'RU-TANK-201', name: 'T-201 汽油储罐单元', parentName: '成品油罐组',
    areaId: 'area-05', areaName: '储罐区', ownerDepartment: '储运部', owner: '何军', medium: '汽油',
    accidentTypes: ['火灾爆炸', '中毒窒息'], staticLevel: 'high', currentLevel: 'high',
    controls: ['液位高高联锁', '罐区泡沫灭火系统', '防火堤完整性月检'], linkedGds: 6, linkedVoc: 2, linkedMes: 4, linkedPlans: 2,
    dynamicFactors: [{ source: 'VOC', label: '储罐呼吸气排口负荷偏高', impact: 'watch', status: '44 mg/m³' }],
  },
  {
    id: 'risk-003', code: 'RU-CDU-F201', name: 'F-201 加热炉单元', parentName: '常减压加热系统',
    areaId: 'area-01', areaName: '常减压装置', ownerDepartment: '常减压装置', owner: '高峰', medium: '燃料气、原油',
    accidentTypes: ['炉膛爆燃', '高温灼烫'], staticLevel: 'high', currentLevel: 'high',
    controls: ['燃烧器火焰检测', '炉膛压力联锁', '进料低流量切断'], linkedGds: 3, linkedVoc: 0, linkedMes: 8, linkedPlans: 1,
    dynamicFactors: [{ source: 'MES', label: '泵出口压力接近上限', impact: 'watch', status: '2.34 MPa' }],
  },
  {
    id: 'risk-004', code: 'RU-SRU-RTO', name: 'RTO 废气治理单元', parentName: '尾气治理系统',
    areaId: 'area-04', areaName: '硫磺回收装置', ownerDepartment: '安全环保部', owner: '周敏', medium: '含硫尾气、VOC',
    accidentTypes: ['异常排放', '设备火灾'], staticLevel: 'medium', currentLevel: 'medium',
    controls: ['燃烧室温度联锁', '进出口浓度在线监测', '旁路阀门铅封管理'], linkedGds: 2, linkedVoc: 3, linkedMes: 5, linkedPlans: 1,
    dynamicFactors: [{ source: 'VOC', label: 'RTO 出口浓度接近限值', impact: 'watch', status: '56 mg/m³' }],
  },
  {
    id: 'risk-005', code: 'RU-HCU-R101', name: 'R-101 加氢反应单元', parentName: '加氢反应系统',
    areaId: 'area-03', areaName: '加氢装置', ownerDepartment: '加氢装置', owner: '马勇', medium: '氢气、硫化氢',
    accidentTypes: ['火灾爆炸', '中毒'], staticLevel: 'critical', currentLevel: 'high',
    controls: ['反应器超温泄压', '循环氢纯度在线分析', '硫化氢区域报警'], linkedGds: 7, linkedVoc: 0, linkedMes: 9, linkedPlans: 2,
    dynamicFactors: [{ source: 'MES', label: '装置运行参数稳定', impact: 'watch', status: '稳定' }],
  },
  {
    id: 'risk-006', code: 'RU-LOAD-01', name: '汽车装车栈台单元', parentName: '油品装卸系统',
    areaId: 'area-06', areaName: '油品装卸区', ownerDepartment: '储运部', owner: '宋伟', medium: '汽柴油',
    accidentTypes: ['泄漏', '车辆伤害'], staticLevel: 'medium', currentLevel: 'medium',
    controls: ['静电接地联锁', '鹤管拉断阀', '车辆限速与导流'], linkedGds: 4, linkedVoc: 2, linkedMes: 2, linkedPlans: 1,
    dynamicFactors: [{ source: '作业许可', label: '装卸栈台临时用电', impact: 'watch', status: '待审批' }],
  },
];

const hazards: Hazard[] = [
  { id: 'hazard-001', code: 'YH20260711001', title: 'P-208 同类高温泵法兰垫片选型待复核', areaId: 'area-02', areaName: '催化裂化装置', level: '重大', source: '复盘整改', category: '设备完整性', ownerDepartment: '设备管理部', owner: '孙工', discoveredAt: '2026-07-11', deadline: '2026-07-15', status: '整改中', riskUnitId: 'risk-001', overdue: false, recurrenceCount: 1, description: '事件复盘发现同类高温泵可能存在垫片选型裕量不足。', measures: ['完成 12 台同类泵材料复核', '不符合项停机窗口更换'] },
  { id: 'hazard-002', code: 'YH20260710006', title: '储罐区东侧消防通道临时占用', areaId: 'area-05', areaName: '储罐区', level: '较大', source: '现场检查', category: '消防安全', ownerDepartment: '储运部', owner: '何军', discoveredAt: '2026-07-10', deadline: '2026-07-12', status: '待验收', riskUnitId: 'risk-002', overdue: true, recurrenceCount: 0, description: '施工材料占用部分消防通道，现场已完成清运并提交验收。', measures: ['清除占道物料', '恢复消防通道标识'] },
  { id: 'hazard-003', code: 'YH20260712003', title: 'RTO 旁路阀铅封台账记录不完整', areaId: 'area-04', areaName: '硫磺回收装置', level: '一般', source: '专项检查', category: '环保设施', ownerDepartment: '安全环保部', owner: '周敏', discoveredAt: '2026-07-12', deadline: '2026-07-16', status: '待整改', riskUnitId: 'risk-004', overdue: false, recurrenceCount: 0, description: '现场铅封编号与月度台账存在一处缺项。', measures: ['补齐铅封编号', '复核当月巡检记录'] },
  { id: 'hazard-004', code: 'YH20260709009', title: 'F-201 炉前压力表校验标签模糊', areaId: 'area-01', areaName: '常减压装置', level: '一般', source: '现场检查', category: '仪表管理', ownerDepartment: '仪控中心', owner: '刘工', discoveredAt: '2026-07-09', deadline: '2026-07-11', status: '已关闭', riskUnitId: 'risk-003', overdue: false, recurrenceCount: 0, description: '校验标签字迹模糊，已重新张贴并完成照片取证。', measures: ['更换校验标签'] },
  { id: 'hazard-005', code: 'YH20260713002', title: '装车栈台一处静电接地夹磨损', areaId: 'area-06', areaName: '油品装卸区', level: '较大', source: '现场检查', category: '电气安全', ownerDepartment: '储运部', owner: '宋伟', discoveredAt: '2026-07-13', deadline: '2026-07-13', status: '待整改', riskUnitId: 'risk-006', overdue: false, recurrenceCount: 1, description: '接地夹齿口磨损，夹持可靠性下降。', measures: ['立即停用对应车位', '更换防爆静电接地夹'] },
  { id: 'hazard-006', code: 'YH20260713005', title: 'GDS 趋势预警转化现场排查', areaId: 'area-02', areaName: '催化裂化装置', level: '较大', source: '预警转化', category: '泄漏管理', ownerDepartment: '催化裂化装置', owner: '李建国', discoveredAt: '2026-07-13', deadline: '2026-07-13', status: '整改中', riskUnitId: 'risk-001', overdue: false, recurrenceCount: 0, description: 'GDS-101 浓度持续上升，已转化隐患并开展泄漏点排查。', measures: ['便携仪器复测', '检查泵密封及法兰'] },
];

const workPermits: WorkPermit[] = [
  { id: 'permit-001', code: 'DH-20260713-018', type: '动火作业', areaId: 'area-02', areaName: '催化裂化装置', workContent: 'P-208 泵出口法兰修复', applicant: '李建国', guardian: '王强', startAt: '07-13 08:00', endAt: '07-13 12:00', riskLevel: '重大', status: '作业中', gasTest: '07:55 O₂ 20.8%，可燃气 0%LEL，合格', linkedGdsCodes: ['GDS-101', 'GDS-FCC-08'], safetyMeasures: ['系统隔离并加盲板', '清除 15 米内可燃物', '消防器材现场到位', '专人连续气体监测'] },
  { id: 'permit-002', code: 'SX-20260713-006', type: '受限空间', areaId: 'area-05', areaName: '储罐区', workContent: 'T-206 罐内防腐检查', applicant: '何军', guardian: '孟师傅', startAt: '07-13 09:00', endAt: '07-13 16:00', riskLevel: '重大', status: '待审批', gasTest: '等待首次气体检测', linkedGdsCodes: ['GDS-TANK-11'], safetyMeasures: ['工艺隔离', '强制通风', '出入口监护', '应急救援器材到位'] },
  { id: 'permit-003', code: 'GC-20260713-011', type: '高处作业', areaId: 'area-04', areaName: '硫磺回收装置', workContent: 'RTO 烟囱平台仪表检修', applicant: '周敏', guardian: '张凯', startAt: '07-13 08:30', endAt: '07-13 11:30', riskLevel: '较大', status: '作业中', gasTest: '非受限空间，无需检测', linkedGdsCodes: [], safetyMeasures: ['双钩安全带', '工具防坠绳', '下方设置警戒区'] },
  { id: 'permit-004', code: 'DZ-20260713-003', type: '吊装作业', areaId: 'area-01', areaName: '常减压装置', workContent: 'P-102 备用泵吊装就位', applicant: '高峰', guardian: '陈斌', startAt: '07-13 06:30', endAt: '07-13 09:30', riskLevel: '较大', status: '已关闭', gasTest: '作业完成，票证关闭', linkedGdsCodes: [], safetyMeasures: ['吊具检查合格', '吊装区域隔离'] },
  { id: 'permit-005', code: 'LD-20260713-009', type: '临时用电', areaId: 'area-06', areaName: '油品装卸区', workContent: '三号装车位照明检修', applicant: '宋伟', guardian: '郭师傅', startAt: '07-13 10:00', endAt: '07-13 14:00', riskLevel: '一般', status: '待审批', gasTest: '等待属地确认', linkedGdsCodes: ['GDS-LOAD-06'], safetyMeasures: ['防爆配电箱', '漏电保护试验', '电缆架空保护'] },
];

const warningRuleSeeds: Array<Omit<WarningRule, 'publishStatus' | 'version' | 'draft' | 'versions'>> = [
  {
    id: 'rule-001', code: 'GDS_L2_01', name: '可燃气体二级报警', source: 'GDS',
    scenario: 'gds-level2', level: 'critical', scope: '全厂 GDS 可燃气体测点',
    condition: '测量值 ≥ 二级报警阈值', duration: '即时触发',
    notifyTargets: ['岗位操作员', '当班班长', '生产调度'], enabled: true, triggerCount: 12,
    lastTriggeredAt: '2026-07-11 08:28:42', description: '单点达到二级阈值后生成重大预警并启动逐级通知。',
  },
  {
    id: 'rule-002', code: 'VOC_OVER_10M', name: 'VOC 连续超限', source: 'VOC',
    scenario: 'voc-overlimit', level: 'high', scope: '有组织排口',
    condition: '排口浓度 > 排放限值', duration: '连续 10 分钟',
    notifyTargets: ['环保管理人员', '装置负责人', '生产调度'], enabled: true, triggerCount: 4,
    lastTriggeredAt: '2026-07-10 14:36:20', description: '连续超限时同步检查治理设施效率和装置负荷。',
  },
  {
    id: 'rule-003', code: 'GDS_MES_01', name: '工艺介质泄漏联合研判', source: '联合预警',
    scenario: 'joint-leak', level: 'critical', scope: '装置泵区 50 米范围',
    condition: 'GDS 浓度上升 + 压力升高或流量下降', duration: '时间窗口 ≤ 5 分钟',
    notifyTargets: ['岗位操作员', '装置负责人', '生产调度', 'QHSE 值班'], enabled: true, triggerCount: 3,
    lastTriggeredAt: '2026-07-08 19:12:06', description: '多源信号同时成立时提升为重大联合预警。',
  },
  {
    id: 'rule-004', code: 'GDS_TREND_05', name: '可燃气体持续上升趋势', source: 'GDS',
    scenario: 'gds-trend', level: 'medium', scope: '全厂 GDS 可燃气体测点',
    condition: '连续 5 个采样点单调上升且当前值 ≥ 15%LEL', duration: '连续 5 分钟',
    notifyTargets: ['岗位操作员'], enabled: true, triggerCount: 27,
    lastTriggeredAt: '2026-07-13 07:42:10', description: '在达到正式阈值前发出趋势提醒，提前开展现场确认。',
  },
  {
    id: 'rule-005', code: 'PERMIT_ALARM_01', name: '高风险作业告警联动', source: '作业许可',
    scenario: 'permit-linkage', level: 'high', scope: '告警区域内在办作业票',
    condition: '较大及以上告警 + 同区域作业中票证', duration: '即时触发',
    notifyTargets: ['作业负责人', '现场监护人', '属地负责人'], enabled: true, triggerCount: 8,
    lastTriggeredAt: '2026-07-11 08:28:45', description: '命中后生成暂停建议，由现场负责人确认并组织复测。',
  },
  {
    id: 'rule-006', code: 'MES_PRESSURE_02', name: '关键机泵出口压力偏高', source: 'MES',
    scenario: 'joint-leak', level: 'medium', scope: '关键机泵压力测点',
    condition: '压力 ≥ 高限值且持续波动', duration: '连续 3 分钟',
    notifyTargets: ['岗位操作员', '生产调度'], enabled: false, triggerCount: 6,
    lastTriggeredAt: '2026-07-05 11:09:32', description: '单一工艺异常提醒；停用期间由联合规则继续监测。',
  },
];

const warningRules: WarningRule[] = warningRuleSeeds.map((rule) => ({
  ...rule,
  publishStatus: '已发布',
  version: 1,
  versions: [{
    name: rule.name,
    source: rule.source,
    scenario: rule.scenario,
    level: rule.level,
    scope: rule.scope,
    condition: rule.condition,
    duration: rule.duration,
    notifyTargets: rule.notifyTargets,
    description: rule.description,
    version: 1,
    publishedAt: '2026-07-01 09:00:00',
    publisher: '赵磊 / QHSE 管理部',
  }],
}));

const emergencyEvents: EmergencyEvent[] = [
  {
    id: 'lifecycle-001', eventId: 'evt-001', code: 'EC20260711001', title: '可燃气体浓度持续上升',
    areaId: 'area-02', areaName: '催化裂化装置', source: 'GDS', status: '响应中', responseLevel: 'II级',
    commander: '陈涛 / 生产调度', ownerDepartment: '催化裂化装置', startedAt: '2026-07-11 08:28:42',
    updatedAt: '2026-07-11 08:30:18', summary: 'FCC 泵区 GDS-101 达到二级报警，已启动泄漏现场处置方案。',
    operations: [
      { id: 'lifecycle-001-1', action: '事件生成', operator: '系统', operatedAt: '2026-07-11 08:28:42', toStatus: '待研判', toLevel: 'II级', detail: 'GDS 二级报警自动生成应急事件。' },
      { id: 'lifecycle-001-2', action: '告警确认', operator: '王强 / 岗位操作员', operatedAt: '2026-07-11 08:29:03', fromStatus: '待研判', toStatus: '待研判', fromLevel: 'II级', toLevel: 'II级', detail: '现场确认存在异常气味和可燃气体浓度升高。' },
      { id: 'lifecycle-001-3', action: '研判启动', operator: '陈涛 / 生产调度', operatedAt: '2026-07-11 08:30:18', fromStatus: '待研判', toStatus: '响应中', fromLevel: 'II级', toLevel: 'II级', detail: '研判确认事件需要应急响应，已启动现场处置。' },
    ],
  },
  {
    id: 'lifecycle-002', eventId: 'evt-002', code: 'EC20260711002', title: 'RTO 出口浓度接近限值',
    areaId: 'area-04', areaName: '硫磺回收装置', source: 'VOC', status: '监控中', responseLevel: 'IV级',
    commander: '周敏 / 环保管理', ownerDepartment: '安全环保部', startedAt: '2026-07-11 08:19:06',
    updatedAt: '2026-07-11 09:05:21', summary: '治理设施参数已恢复，排口浓度连续 30 分钟低于预警值，进入持续监控。',
    operations: [
      { id: 'lifecycle-002-1', action: '事件生成', operator: '系统', operatedAt: '2026-07-11 08:19:06', toStatus: '待研判', toLevel: 'IV级', detail: 'VOC 趋势预警生成应急事件。' },
      { id: 'lifecycle-002-2', action: '研判启动', operator: '周敏 / 环保管理', operatedAt: '2026-07-11 08:21:12', fromStatus: '待研判', toStatus: '响应中', fromLevel: 'IV级', toLevel: 'IV级', detail: '启动环保异常现场核查。' },
      { id: 'lifecycle-002-3', action: '终止响应', operator: '周敏 / 环保管理', operatedAt: '2026-07-11 09:05:21', fromStatus: '响应中', toStatus: '监控中', fromLevel: 'IV级', toLevel: 'IV级', detail: '治理设施恢复稳定，终止响应并持续监控。' },
    ],
  },
  {
    id: 'lifecycle-003', eventId: 'evt-003', code: 'EC20260711003', title: '泵出口压力偏高',
    areaId: 'area-01', areaName: '常减压装置', source: 'MES', status: '待关闭', responseLevel: 'IV级',
    commander: '高峰 / 装置值班', ownerDepartment: '常减压装置', startedAt: '2026-07-11 08:11:37',
    updatedAt: '2026-07-11 10:18:44', summary: '压力波动原因已排查，现场数据稳定，关闭材料已提交 QHSE 管理部审批。',
    operations: [
      { id: 'lifecycle-003-1', action: '事件生成', operator: '系统', operatedAt: '2026-07-11 08:11:37', toStatus: '待研判', toLevel: 'IV级', detail: 'MES 压力异常生成应急事件。' },
      { id: 'lifecycle-003-2', action: '研判启动', operator: '高峰 / 装置值班', operatedAt: '2026-07-11 08:15:06', fromStatus: '待研判', toStatus: '响应中', fromLevel: 'IV级', toLevel: 'IV级', detail: '启动设备和工艺联合排查。' },
      { id: 'lifecycle-003-3', action: '终止响应', operator: '高峰 / 装置值班', operatedAt: '2026-07-11 09:46:30', fromStatus: '响应中', toStatus: '监控中', fromLevel: 'IV级', toLevel: 'IV级', detail: '压力恢复正常，进入稳定性监控。' },
      { id: 'lifecycle-003-4', action: '申请关闭', operator: '高峰 / 装置值班', operatedAt: '2026-07-11 10:18:44', fromStatus: '监控中', toStatus: '待关闭', fromLevel: 'IV级', toLevel: 'IV级', detail: '监测稳定且排查任务完成，提交关闭审批。' },
    ],
  },
  {
    id: 'lifecycle-004', eventId: 'evt-004', code: 'EC20260713004', title: '装卸区可燃气体趋势异常',
    areaId: 'area-06', areaName: '油品装卸区', source: 'GDS', status: '待研判', responseLevel: 'IV级',
    commander: '待指定', ownerDepartment: '储运部', startedAt: '2026-07-13 07:42:10',
    updatedAt: '2026-07-13 07:42:10', summary: 'GDS-LOAD-06 连续五个采样点上升，尚未达到一级报警阈值，等待现场研判。',
    operations: [
      { id: 'lifecycle-004-1', action: '事件生成', operator: '系统', operatedAt: '2026-07-13 07:42:10', toStatus: '待研判', toLevel: 'IV级', detail: '趋势规则命中，自动生成待研判事件。' },
    ],
  },
];

const dashboard: DashboardData = {
  updatedAt: '2026-07-11 08:32:18',
  metrics: {
    overallRisk: '一般风险',
    onlineUnits: 8,
    gdsOnlineRate: 96.7,
    activeAlarms: 3,
    vocComplianceRate: 98.6,
    mesAnomalies: 2,
    pendingWarnings: 4,
    highRiskPermits: 2,
    deliveryRate: 94.8,
  },
  areas: [
    {
      id: 'area-01',
      code: 'CDU',
      name: '常减压装置',
      shortName: '常减压',
      riskLevel: 'medium',
      status: 'warning',
      x: 7,
      y: 14,
      width: 23,
      height: 28,
    },
    {
      id: 'area-02',
      code: 'FCC',
      name: '催化裂化装置',
      shortName: '催化裂化',
      riskLevel: 'high',
      status: 'alarm',
      x: 38,
      y: 9,
      width: 24,
      height: 32,
    },
    {
      id: 'area-03',
      code: 'HCU',
      name: '加氢装置',
      shortName: '加氢',
      riskLevel: 'medium',
      status: 'normal',
      x: 70,
      y: 15,
      width: 22,
      height: 25,
    },
    {
      id: 'area-04',
      code: 'SRU',
      name: '硫磺回收装置',
      shortName: '硫磺回收',
      riskLevel: 'low',
      status: 'normal',
      x: 8,
      y: 58,
      width: 20,
      height: 25,
    },
    {
      id: 'area-05',
      code: 'TANK',
      name: '储罐区',
      shortName: '储罐区',
      riskLevel: 'high',
      status: 'warning',
      x: 37,
      y: 56,
      width: 24,
      height: 28,
    },
    {
      id: 'area-06',
      code: 'LOAD',
      name: '油品装卸区',
      shortName: '装卸区',
      riskLevel: 'medium',
      status: 'normal',
      x: 70,
      y: 55,
      width: 22,
      height: 27,
    },
  ],
  alarms: [
    {
      id: 'evt-001',
      code: 'W20260711001',
      title: '可燃气体浓度持续上升',
      source: 'GDS',
      areaId: 'area-02',
      areaName: '催化裂化装置',
      level: 'high',
      value: '38% LEL',
      occurredAt: '08:28:42',
      status: '待确认',
    },
    {
      id: 'evt-002',
      code: 'W20260711002',
      title: 'RTO 出口浓度接近限值',
      source: 'VOC',
      areaId: 'area-04',
      areaName: '硫磺回收装置',
      level: 'medium',
      value: '56 mg/m³',
      occurredAt: '08:19:06',
      status: '处置中',
    },
    {
      id: 'evt-003',
      code: 'W20260711003',
      title: '泵出口压力偏高',
      source: 'MES',
      areaId: 'area-01',
      areaName: '常减压装置',
      level: 'medium',
      value: '2.34 MPa',
      occurredAt: '08:11:37',
      status: '监控中',
    },
  ],
  trend: [
    { label: '07:40', gds: 18, voc: 43, mes: 44 },
    { label: '07:50', gds: 20, voc: 46, mes: 48 },
    { label: '08:00', gds: 19, voc: 51, mes: 46 },
    { label: '08:10', gds: 24, voc: 48, mes: 53 },
    { label: '08:20', gds: 29, voc: 54, mes: 58 },
    { label: '08:30', gds: 38, voc: 56, mes: 62 },
  ],
  gdsPoints,
  vocPoints,
  vocFacilities,
  mesTags,
  mesUnits,
  communicationTasks,
  emergencyPlan: {
    id: 'plan-001', code: 'QHSE-FCC-LEAK-01', name: '可燃气体泄漏现场处置方案',
    eventId: 'evt-001', responseLevel: 'II级', matchScore: 96,
    matchReason: 'GDS二级报警 + 浓度持续上升 + FCC高负荷运行', commander: '陈涛 / 生产调度',
    assemblyPoint: 'FCC 北侧应急集合点', status: '已启动',
  },
  emergencyPlans,
  emergencyTasks,
  emergencyResources,
  eventReviews,
  riskUnits,
  hazards,
  workPermits,
  warningRules,
  emergencyEvents,
};

export default {
  'GET /api/qhse/dashboard': (_req: unknown, res: { send: (value: unknown) => void }) => {
    res.send({ success: true, data: dashboard });
  },
};
