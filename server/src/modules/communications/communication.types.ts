export type CommunicationChannel = 'App消息' | '电话语音' | '短信' | 'IP广播';
export interface CommunicationTask {
  id: string;
  eventId: string;
  eventTitle: string;
  receiver: string;
  receiverRole: string;
  channel: CommunicationChannel;
  sendTime: string;
  deliveryStatus: '发送中' | '已送达' | '失败';
  confirmStatus: '待确认' | '未确认' | '已确认';
  confirmTime?: string;
  confirmedBy?: string;
  sentBy?: string;
  retryCount: number;
  escalationLevel: 0 | 1 | 2 | 3;
}
export interface CommunicationDispatch {
  id: string;
  eventId: string;
  eventCode: string;
  eventTitle: string;
  areaName: string;
  eventLevel: 'low' | 'medium' | 'high' | 'critical';
  status: '待确认' | '已确认' | '升级完成';
  escalationLevel: 0 | 1 | 2 | 3;
  tasks: CommunicationTask[];
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface CommunicationMutation {
  status?: CommunicationDispatch['status'];
  escalationLevel?: CommunicationDispatch['escalationLevel'];
  tasks: CommunicationTask[];
  updatedAt: string;
}
export interface CommunicationActor {
  actorId: string;
  actorName: string;
}
