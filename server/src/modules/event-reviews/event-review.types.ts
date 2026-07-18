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
  linkedHazardId?: string;
  linkedHazardCode?: string;
  linkedHazardStatus?: '待整改' | '整改中' | '待验收' | '已关闭';
  linkedAt?: string;
}

export interface EventReviewTimelineItem {
  time: string;
  title: string;
  detail: string;
  status: 'done' | 'active' | 'pending';
}

export interface EventReviewEvidence {
  id: string;
  objectId: string;
  name: string;
  category: '调查报告' | '现场照片' | '检测报告' | '培训记录';
  note: string;
  uploaderId: string;
  uploader: string;
  uploadedAt: string;
  hash: string;
  contentType?: string;
  size?: number;
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
  evidence: EventReviewEvidence[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventReviewAccess {
  actorId: string;
  actorName: string;
  allowedAreaIds?: string[];
}
