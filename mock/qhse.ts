import type {
  DashboardData,
  CommunicationTask,
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
};

export default {
  'GET /api/qhse/dashboard': (_req: unknown, res: { send: (value: unknown) => void }) => {
    res.send({ success: true, data: dashboard });
  },
};
