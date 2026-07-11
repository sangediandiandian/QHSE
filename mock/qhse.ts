import type { DashboardData, GdsPoint, VocFacility, VocPoint } from '../src/types/qhse';

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
};

export default {
  'GET /api/qhse/dashboard': (_req: unknown, res: { send: (value: unknown) => void }) => {
    res.send({ success: true, data: dashboard });
  },
};
