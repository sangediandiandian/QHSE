import type {
  DashboardData,
  CommunicationTask,
  EmergencyResource,
  EmergencyTask,
  EmergencyPlanTemplate,
  EventReview,
  GdsPoint,
  MesTag,
  MesUnit,
  VocFacility,
  VocPoint,
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
  { id: 'res-001', code: 'FIRE-TRUCK-01', name: '泡沫消防车', type: '消防', quantity: '2 辆', location: '消防站', eta: '3 分钟', status: '调度中', owner: '张伟', contact: '6001', lastInspection: '2026-07-01', inspectionStatus: '检查合格' },
  { id: 'res-002', code: 'SCBA-FCC-01', name: '正压式空气呼吸器', type: '气防', quantity: '12 套', location: 'FCC 气防柜', eta: '已到场', status: '已到位', owner: '刘洋', contact: '6218', lastInspection: '2026-07-08', inspectionStatus: '检查合格' },
  { id: 'res-003', code: 'MED-AED-01', name: '急救担架与 AED', type: '医疗', quantity: '2 组', location: '厂区医务室', eta: '6 分钟', status: '待命', owner: '林晓', contact: '6120', lastInspection: '2026-06-26', inspectionStatus: '即将到期' },
  { id: 'res-004', code: 'LEAK-KIT-01', name: '防爆警戒与堵漏工具', type: '物资', quantity: '1 批', location: '应急物资库', eta: '5 分钟', status: '调度中', owner: '赵磊', contact: '6058', lastInspection: '2026-07-05', inspectionStatus: '检查合格' },
  { id: 'res-005', code: 'FIRE-ROBOT-01', name: '防爆消防机器人', type: '消防', quantity: '1 台', location: '消防站二库', eta: '8 分钟', status: '待命', owner: '张伟', contact: '6001', lastInspection: '2026-06-18', inspectionStatus: '需要维护' },
  { id: 'res-006', code: 'GAS-MOBILE-02', name: '移动式气体检测组', type: '气防', quantity: '6 台', location: '中央控制室', eta: '4 分钟', status: '待命', owner: '刘洋', contact: '6218', lastInspection: '2026-07-09', inspectionStatus: '检查合格' },
  { id: 'res-007', code: 'MED-AMB-01', name: '厂区救护车', type: '医疗', quantity: '1 辆', location: '厂区医务室', eta: '5 分钟', status: '待命', owner: '林晓', contact: '6120', lastInspection: '2026-07-02', inspectionStatus: '检查合格' },
  { id: 'res-008', code: 'BOOM-ABS-01', name: '围油栏与吸附材料', type: '物资', quantity: '3 套', location: '储运应急库', eta: '10 分钟', status: '待命', owner: '周敏', contact: '6077', lastInspection: '2026-06-30', inspectionStatus: '检查合格' },
];

const emergencyPlans: EmergencyPlanTemplate[] = [
  { id: 'tpl-001', code: 'QHSE-FCC-LEAK-01', name: '可燃气体泄漏现场处置方案', category: '现场处置方案', eventType: '可燃气体泄漏', applicableArea: '催化裂化装置', medium: '烃类可燃气体', responseLevel: 'II级', triggerRule: 'GDS 达到二级报警或多点浓度持续上升', notificationTargets: ['岗位人员', '装置负责人', '生产调度', '消防气防'], steps: ['停止作业并撤离现场', '切断物料与火源', '设置警戒并持续监测', '组织堵漏与恢复评估'], resources: ['泡沫消防车', '空气呼吸器', '防爆堵漏工具'], version: 'V3.2', effectiveDate: '2026-05-01', status: '生效中', ownerDepartment: '催化裂化装置' },
  { id: 'tpl-002', code: 'QHSE-GAS-H2S-02', name: '硫化氢泄漏专项应急预案', category: '专项应急预案', eventType: '有毒气体泄漏', applicableArea: '全厂含硫装置', medium: '硫化氢', responseLevel: 'I级', triggerRule: 'H₂S 浓度达到 20ppm 或出现人员中毒', notificationTargets: ['应急指挥人员', '消防气防', '医疗救护', '属地负责人'], steps: ['佩戴正压式呼吸器', '上风向组织撤离', '搜救受影响人员', '隔离泄漏源并通风'], resources: ['气防车', '空气呼吸器', '急救担架', '便携式检测仪'], version: 'V2.6', effectiveDate: '2026-03-15', status: '生效中', ownerDepartment: '安全环保部' },
  { id: 'tpl-003', code: 'QHSE-ENV-VOC-03', name: 'VOC 异常排放专项处置预案', category: '专项应急预案', eventType: '环境污染事件', applicableArea: 'VOC 治理设施及排口', medium: '非甲烷总烃', responseLevel: 'III级', triggerRule: '排口连续 10 分钟超限或治理效率低于 80%', notificationTargets: ['环保管理人员', '装置负责人', '生产调度'], steps: ['核查在线数据与设备状态', '切换备用治理设施', '降低相关装置负荷', '开展厂界加密监测'], resources: ['便携式 VOC 分析仪', '移动治理设备'], version: 'V2.1', effectiveDate: '2026-04-20', status: '生效中', ownerDepartment: '安全环保部' },
  { id: 'tpl-004', code: 'QHSE-TANK-FIRE-01', name: '储罐火灾爆炸专项应急预案', category: '专项应急预案', eventType: '火灾爆炸', applicableArea: '储罐区', medium: '油品及化学品', responseLevel: 'I级', triggerRule: '储罐明火、温度突升或可燃气体多点报警', notificationTargets: ['企业应急指挥部', '消防气防', '生产调度', '医疗救护'], steps: ['启动固定消防设施', '切断进出料并冷却相邻罐', '扩大警戒和人员疏散', '实施泡沫灭火'], resources: ['大流量泡沫车', '消防机器人', '移动水炮'], version: 'V4.0', effectiveDate: '2026-06-01', status: '生效中', ownerDepartment: '储运部' },
  { id: 'tpl-005', code: 'QHSE-GEN-2026', name: '生产安全事故综合应急预案', category: '综合应急预案', eventType: '综合事故', applicableArea: '全厂', medium: '多介质', responseLevel: 'I级', triggerRule: '重大事故或多个专项预案协同启动', notificationTargets: ['企业应急指挥部', '各专业应急组', '属地政府联络人'], steps: ['成立现场指挥部', '启动专业应急组', '统一资源和信息发布', '组织恢复与事故调查'], resources: ['指挥通信车', '全厂应急资源清单'], version: 'V5.1', effectiveDate: '2026-01-01', status: '生效中', ownerDepartment: 'QHSE 管理部' },
  { id: 'tpl-006', code: 'CARD-CDU-PUMP-07', name: '常减压泵区泄漏岗位处置卡', category: '岗位应急处置卡', eventType: '管线及设备泄漏', applicableArea: '常减压装置泵区', medium: '原油及成品油', responseLevel: 'IV级', triggerRule: '现场发现滴漏、异味或单点低限报警', notificationTargets: ['岗位班长', '装置值班人员'], steps: ['按下紧急停泵按钮', '关闭进出口阀门', '报告班长并设置临时警戒', '使用吸附材料控制扩散'], resources: ['吸油毡', '便携式检测仪', '防爆工具'], version: 'V1.4', effectiveDate: '2025-11-10', status: '待评审', ownerDepartment: '常减压装置' },
];

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
};

export default {
  'GET /api/qhse/dashboard': (_req: unknown, res: { send: (value: unknown) => void }) => {
    res.send({ success: true, data: dashboard });
  },
};
