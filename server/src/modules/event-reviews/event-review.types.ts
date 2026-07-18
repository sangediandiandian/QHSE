export type EventReviewStatus = '待关闭' | '已复盘';
export type ReviewActionStatus = '待整改' | '整改中' | '已完成';

export interface ReviewAction {
  id: string;
  title: string;
  ownerDepartment: string;
  owner: string;
  deadline: string;
  priority: '一般' | '重要' | '紧急';
  status: ReviewActionStatus;
  updatedById?: string;
  updatedBy?: string;
  updatedAt?: string;
  completedAt?: string;
}

export interface EventReviewTimelineItem {
  time: string;
  title: string;
  detail: string;
  status: 'done' | 'active' | 'pending';
}

export interface EventReview {
  id: string;
  eventId: string;
  eventCode: string;
  eventTitle: string;
  areaId: string;
  areaName: string;
  reviewCode: string;
  status: EventReviewStatus;
  reviewer: string;
  summary: string;
  directCause: string;
  rootCause: string;
  lesson: string;
  controlledAt: string;
  closedAt?: string;
  timeline: EventReviewTimelineItem[];
  actions: ReviewAction[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventReviewAccess {
  actorId: string;
  actorName: string;
  allowedAreaIds?: string[];
}
