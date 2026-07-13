import type { AlarmEvent, HazardStatus, WorkPermit, WorkPermitStatus } from '@/types/qhse';

const hazardTransitions: Record<HazardStatus, HazardStatus> = {
  待整改: '整改中',
  整改中: '待验收',
  待验收: '已关闭',
  已关闭: '已关闭',
};

export function nextHazardStatus(status: HazardStatus) {
  return hazardTransitions[status];
}

export function applyPermitAlarmLinkage(permits: WorkPermit[], alarms: AlarmEvent[]) {
  const alarmByArea = new Map(
    alarms
      .filter((alarm) => alarm.level === 'high' || alarm.level === 'critical')
      .map((alarm) => [alarm.areaId, alarm]),
  );

  return permits.map((permit) => {
    const alarm = alarmByArea.get(permit.areaId);
    if (permit.status !== '作业中' || !alarm) return permit;
    return {
      ...permit,
      status: '建议暂停' as const,
      alertReason: `${alarm.source} ${alarm.level === 'critical' ? '重大' : '较大'}预警：${alarm.title}`,
    };
  });
}

export function nextPermitStatus(status: WorkPermitStatus): WorkPermitStatus {
  if (status === '建议暂停') return '已暂停';
  if (status === '已暂停') return '作业中';
  return status;
}
