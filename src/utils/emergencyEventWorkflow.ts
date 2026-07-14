import type {
  EmergencyEvent,
  EmergencyEventAction,
  EmergencyEventEvidence,
  EmergencyEventStatus,
  EmergencyResponseLevel,
} from '@/types/qhse';

const levels: EmergencyResponseLevel[] = ['IV级', 'III级', 'II级', 'I级'];

export function isEmergencyEventActionAllowed(
  event: EmergencyEvent,
  action: EmergencyEventAction,
) {
  if (action === '研判启动') return event.status === '待研判';
  if (action === '升级响应') return event.status === '响应中' && event.responseLevel !== 'I级';
  if (action === '降级响应') return event.status === '响应中' && event.responseLevel !== 'IV级';
  if (action === '终止响应') return event.status === '响应中';
  if (action === '申请关闭') return event.status === '监控中';
  return event.status === '待关闭';
}

function nextState(event: EmergencyEvent, action: EmergencyEventAction) {
  const currentIndex = levels.indexOf(event.responseLevel);
  if (action === '研判启动') return { status: '响应中' as const, level: event.responseLevel };
  if (action === '升级响应') return { status: event.status, level: levels[currentIndex + 1] };
  if (action === '降级响应') return { status: event.status, level: levels[currentIndex - 1] };
  if (action === '终止响应') return { status: '监控中' as const, level: event.responseLevel };
  if (action === '申请关闭') return { status: '待关闭' as const, level: event.responseLevel };
  return { status: '已关闭' as const, level: event.responseLevel };
}

const actionDetail: Record<EmergencyEventAction, string> = {
  研判启动: '研判确认事件需要应急响应，已启动现场处置。',
  升级响应: '根据影响范围和现场反馈提升应急响应等级。',
  降级响应: '风险影响范围缩小，应急响应等级下调。',
  终止响应: '现场风险已受控，终止应急响应并进入持续监控。',
  申请关闭: '监测数据稳定且关键任务完成，已提交关闭审批。',
  审批关闭: '关闭审批通过，事件资料和操作记录已归档。',
};

export function transitionEmergencyEvent(
  event: EmergencyEvent,
  action: EmergencyEventAction,
  operator: string,
  operatedAt: string,
) {
  if (!isEmergencyEventActionAllowed(event, action)) return event;
  const next = nextState(event, action);
  return {
    ...event,
    status: next.status as EmergencyEventStatus,
    responseLevel: next.level,
    updatedAt: operatedAt,
    operations: [
      ...event.operations,
      {
        id: `${event.id}-${event.operations.length + 1}`,
        action,
        operator,
        operatedAt,
        fromStatus: event.status,
        toStatus: next.status as EmergencyEventStatus,
        fromLevel: event.responseLevel,
        toLevel: next.level,
        detail: actionDetail[action],
      },
    ],
  };
}

export function getEmergencyApprovalDueAt(createdAt: string, hours = 4) {
  const date = new Date(createdAt.replace(' ', 'T'));
  date.setHours(date.getHours() + hours);
  const values = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((value) => String(value).padStart(2, '0'));
  return `${values[0]}-${values[1]}-${values[2]} ${values[3]}:${values[4]}:${values[5]}`;
}

export function createEmergencyClosureApproval(
  event: EmergencyEvent,
  applicant: string,
  assignee: string,
  createdAt: string,
): EmergencyEvent {
  if (event.status !== '待关闭' || event.closureApproval) return event;
  return {
    ...event,
    closureApproval: {
      id: `${event.id}-closure`,
      type: '事件关闭',
      applicant,
      assignee,
      status: '待审批',
      createdAt,
      dueAt: getEmergencyApprovalDueAt(createdAt),
      reminderCount: 0,
    },
  };
}

export function addEmergencyEventEvidence(
  event: EmergencyEvent,
  evidence: Omit<EmergencyEventEvidence, 'id' | 'uploadedAt' | 'hash'>,
  id: string,
  uploadedAt: string,
  hash: string,
): EmergencyEvent {
  return {
    ...event,
    evidence: [...(event.evidence ?? []), { ...evidence, id, uploadedAt, hash }],
  };
}

export function isEmergencyApprovalOverdue(event: EmergencyEvent, now: string) {
  const task = event.closureApproval;
  return Boolean(task && task.status === '待审批' && Date.parse(now.replace(' ', 'T')) > Date.parse(task.dueAt.replace(' ', 'T')));
}

export function remindEmergencyClosureApproval(event: EmergencyEvent, remindedAt: string): EmergencyEvent {
  if (!event.closureApproval || event.closureApproval.status !== '待审批') return event;
  return {
    ...event,
    closureApproval: {
      ...event.closureApproval,
      reminderCount: event.closureApproval.reminderCount + 1,
      lastReminderAt: remindedAt,
    },
  };
}

export function approveEmergencyEventClosure(
  event: EmergencyEvent,
  approver: string,
  opinion: string,
  approvedAt: string,
): EmergencyEvent {
  if (event.status !== '待关闭' || event.closureApproval?.status !== '待审批') return event;
  if (!(event.evidence?.length)) throw new Error('至少归档一项事件证据后才能审批关闭');
  if (!opinion.trim()) throw new Error('审批意见不能为空');
  const closed = transitionEmergencyEvent(event, '审批关闭', approver, approvedAt);
  return {
    ...closed,
    closureApproval: {
      ...event.closureApproval,
      status: '已通过',
      approvedAt,
      signature: `${approver}（电子签名）`,
      opinion: opinion.trim(),
    },
  };
}
