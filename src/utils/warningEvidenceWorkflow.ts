import type {
  AlarmEvent,
  DashboardData,
  WarningEvidenceCategory,
  WarningEventOperation,
} from '@/types/qhse';

export interface WarningEvidenceReading {
  id: string;
  code: string;
  name: string;
  value: string;
  status: string;
  trend: number[];
}

export interface WarningEvidenceProcess {
  id: string;
  code: string;
  name: string;
  value: string;
  status: string;
}

export interface WarningEvidencePerson {
  id: string;
  name: string;
  role: string;
  status: string;
}

export interface WarningEvidenceBundle {
  readings: WarningEvidenceReading[];
  processes: WarningEvidenceProcess[];
  permits: DashboardData['workPermits'];
  people: WarningEvidencePerson[];
}

function gdsStatus(status: DashboardData['gdsPoints'][number]['alarmStatus']) {
  return { normal: '正常', level1: '一级报警', level2: '二级报警', trend: '上升趋势' }[status];
}

function vocStatus(status: DashboardData['vocPoints'][number]['status']) {
  return { normal: '达标', warning: '接近限值', exceeded: '超限', offline: '离线' }[status];
}

function mesStatus(status: DashboardData['mesTags'][number]['status']) {
  return { normal: '正常', warning: '接近边界', alarm: '参数异常', offline: '离线' }[status];
}

export function buildWarningEvidence(dashboard: DashboardData, event: AlarmEvent): WarningEvidenceBundle {
  const readings: WarningEvidenceReading[] = [];
  if (event.source === 'GDS' || event.source === '联合预警' || event.source === '作业许可') {
    const rank = { level2: 4, level1: 3, trend: 2, normal: 1 };
    readings.push(...dashboard.gdsPoints.filter((point) => point.areaId === event.areaId)
      .sort((left, right) => rank[right.alarmStatus] - rank[left.alarmStatus])
      .map((point) => ({
      id: point.id,
      code: point.code,
      name: point.name,
      value: `${point.currentValue} ${point.unit}`,
      status: point.onlineStatus === 'online' ? gdsStatus(point.alarmStatus) : point.onlineStatus === 'fault' ? '故障' : '离线',
      trend: point.trend,
      })));
  }
  if (event.source === 'VOC') {
    const rank = { exceeded: 4, warning: 3, offline: 2, normal: 1 };
    readings.push(...dashboard.vocPoints.filter((point) => point.areaId === event.areaId)
      .sort((left, right) => rank[right.status] - rank[left.status])
      .map((point) => ({
      id: point.id,
      code: point.code,
      name: point.name,
      value: `${point.currentValue} mg/m³`,
      status: vocStatus(point.status),
      trend: point.trend,
      })));
  }
  if (event.source === 'MES') {
    readings.push(...dashboard.mesTags.filter((tag) => tag.unitName === event.areaName).map((tag) => ({
      id: tag.id,
      code: tag.code,
      name: tag.name,
      value: `${tag.currentValue} ${tag.unit}`,
      status: mesStatus(tag.status),
      trend: tag.trend,
    })));
  }

  const areaTags = dashboard.mesTags.filter((tag) => tag.unitName === event.areaName);
  const processRank = { alarm: 4, warning: 3, offline: 2, normal: 1 };
  const processes: WarningEvidenceProcess[] = areaTags.length
    ? areaTags.sort((left, right) => processRank[right.status] - processRank[left.status]).map((tag) => ({
      id: tag.id,
      code: tag.code,
      name: tag.name,
      value: `${tag.currentValue} ${tag.unit}`,
      status: mesStatus(tag.status),
    }))
    : dashboard.mesUnits.filter((unit) => unit.name === event.areaName).map((unit) => ({
      id: unit.id,
      code: unit.code,
      name: unit.name,
      value: `${unit.load}% 负荷`,
      status: unit.operatingMode,
    }));

  const permits = dashboard.workPermits.filter((permit) => permit.areaId === event.areaId && permit.status !== '已关闭');
  const people = new Map<string, WarningEvidencePerson>();
  dashboard.communicationTasks.filter((task) => task.eventId === event.id).forEach((task) => {
    people.set(`${task.receiver}-${task.receiverRole}`, {
      id: task.id,
      name: task.receiver,
      role: task.receiverRole,
      status: task.confirmStatus,
    });
  });
  permits.forEach((permit) => {
    people.set(`${permit.applicant}-作业申请人`, { id: `${permit.id}-applicant`, name: permit.applicant, role: '作业申请人', status: permit.status });
    people.set(`${permit.guardian}-现场监护人`, { id: `${permit.id}-guardian`, name: permit.guardian, role: '现场监护人', status: permit.status });
  });

  return { readings, processes, permits, people: [...people.values()] };
}

export function getWarningEvidenceCount(bundle: WarningEvidenceBundle) {
  return [bundle.readings, bundle.processes, bundle.permits, bundle.people].filter((items) => items.length > 0).length;
}

function appendOperation(event: AlarmEvent, operation: WarningEventOperation): AlarmEvent {
  return { ...event, operations: [...(event.operations ?? []), operation] };
}

export function verifyWarningEvidence(
  event: AlarmEvent,
  category: WarningEvidenceCategory,
  checkedBy: string,
  checkedAt: string,
): AlarmEvent {
  if (event.evidenceChecks?.some((item) => item.category === category)) return event;
  return appendOperation({
    ...event,
    evidenceChecks: [...(event.evidenceChecks ?? []), { category, checkedBy, checkedAt }],
  }, {
    id: `evidence-${category}-${checkedAt}`,
    type: '证据核验',
    operator: checkedBy,
    operatedAt: checkedAt,
    detail: `${category}已完成一致性核验`,
  });
}

export function confirmWarningEvent(event: AlarmEvent, operator: string, operatedAt: string): AlarmEvent {
  if (event.status !== '待确认') return event;
  return appendOperation({ ...event, status: '已确认' }, {
    id: `confirm-${operatedAt}`,
    type: '事件确认',
    operator,
    operatedAt,
    detail: '已确认预警真实有效，进入现场处置准备',
  });
}

export function startWarningEmergency(event: AlarmEvent, operator: string, operatedAt: string): AlarmEvent {
  if (event.status !== '已确认') return event;
  return appendOperation({ ...event, status: '处置中' }, {
    id: `start-${operatedAt}`,
    type: '预案启动',
    operator,
    operatedAt,
    detail: '已启动推荐应急预案并生成处置任务',
  });
}
