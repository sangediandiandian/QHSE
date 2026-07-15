import type { WorkPermit } from './work-permit.types';

const timestamp = '2026-07-14T00:00:00.000Z';

const baseRows: Array<
  Omit<
    WorkPermit,
    'approvalSteps' | 'siteConfirmations' | 'version' | 'createdAt' | 'updatedAt' | 'applicantId'
  >
> = [
  {
    id: 'permit-001',
    code: 'DH-20260713-018',
    type: '动火作业',
    areaId: 'area-02',
    areaName: '催化裂化装置',
    workContent: 'P-208 泵出口法兰修复',
    applicant: '李建国',
    guardian: '王强',
    startAt: '2026-07-13 08:00',
    endAt: '2026-07-13 12:00',
    riskLevel: '重大',
    status: '作业中',
    gasTest: '07:55 O₂ 20.8%，可燃气 0%LEL，合格',
    linkedGdsCodes: ['GDS-101', 'GDS-FCC-08'],
    safetyMeasures: [
      '系统隔离并加盲板',
      '清除 15 米内可燃物',
      '消防器材现场到位',
      '专人连续气体监测',
    ],
    workX: 52,
    workY: 24,
  },
  {
    id: 'permit-002',
    code: 'SX-20260713-006',
    type: '受限空间',
    areaId: 'area-05',
    areaName: '储罐区',
    workContent: 'T-206 罐内防腐检查',
    applicant: '何军',
    guardian: '孟师傅',
    startAt: '2026-07-13 09:00',
    endAt: '2026-07-13 16:00',
    riskLevel: '重大',
    status: '待审批',
    gasTest: '等待首次气体检测',
    linkedGdsCodes: ['GDS-TANK-11'],
    safetyMeasures: ['工艺隔离', '强制通风', '出入口监护', '应急救援器材到位'],
    workX: 49,
    workY: 68,
  },
  {
    id: 'permit-003',
    code: 'GC-20260713-011',
    type: '高处作业',
    areaId: 'area-04',
    areaName: '硫磺回收装置',
    workContent: 'RTO 烟囱平台仪表检修',
    applicant: '周敏',
    guardian: '张凯',
    startAt: '2026-07-13 08:30',
    endAt: '2026-07-13 11:30',
    riskLevel: '较大',
    status: '作业中',
    gasTest: '非受限空间，无需检测',
    linkedGdsCodes: [],
    safetyMeasures: ['双钩安全带', '工具防坠绳', '下方设置警戒区'],
    workX: 23,
    workY: 66,
  },
  {
    id: 'permit-004',
    code: 'DZ-20260713-003',
    type: '吊装作业',
    areaId: 'area-01',
    areaName: '常减压装置',
    workContent: 'P-102 备用泵吊装就位',
    applicant: '高峰',
    guardian: '陈斌',
    startAt: '2026-07-13 06:30',
    endAt: '2026-07-13 09:30',
    riskLevel: '较大',
    status: '已关闭',
    gasTest: '作业完成，票证关闭',
    linkedGdsCodes: [],
    safetyMeasures: ['吊具检查合格', '吊装区域隔离'],
    workX: 20,
    workY: 22,
  },
  {
    id: 'permit-005',
    code: 'LD-20260713-009',
    type: '临时用电',
    areaId: 'area-06',
    areaName: '油品装卸区',
    workContent: '三号装车位照明检修',
    applicant: '宋伟',
    guardian: '郭师傅',
    startAt: '2026-07-13 10:00',
    endAt: '2026-07-13 14:00',
    riskLevel: '一般',
    status: '待审批',
    gasTest: '等待属地确认',
    linkedGdsCodes: ['GDS-LOAD-06'],
    safetyMeasures: ['防爆配电箱', '漏电保护试验', '电缆架空保护'],
    workX: 80,
    workY: 69,
  },
];

export const workPermitSeed: WorkPermit[] = baseRows.map((row) => {
  const approved = row.status !== '待审批';
  return {
    ...row,
    applicantId: row.areaId === 'area-04' ? 'user-environment' : 'user-unit',
    approvalSteps: ['属地审核', 'QHSE 审核', '负责人批准'].map((role, index) => ({
      id: `${row.id}-approval-${index + 1}`,
      sequence: index + 1,
      role: role as WorkPermit['approvalSteps'][number]['role'],
      approver: approved
        ? ['李建国', '赵磊', '陈涛'][index]
        : role === '属地审核'
          ? row.guardian
          : role === 'QHSE 审核'
            ? 'QHSE 管理人员'
            : '企业负责人',
      status: approved ? '已通过' : '待审批',
      signedAt: approved ? timestamp : undefined,
      signature: approved ? `${['李建国', '赵磊', '陈涛'][index]}（电子签名）` : undefined,
    })),
    siteConfirmations: approved
      ? [
          {
            id: `${row.id}-confirmation-1`,
            role: '作业负责人',
            confirmerId: 'user-unit',
            confirmer: row.applicant,
            confirmedAt: timestamp,
          },
          {
            id: `${row.id}-confirmation-2`,
            role: '现场监护人',
            confirmerId: 'user-operator',
            confirmer: row.guardian,
            confirmedAt: timestamp,
          },
        ]
      : [],
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
});
