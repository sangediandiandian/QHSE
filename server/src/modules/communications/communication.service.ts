import { ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { CommunicationReceiptDto, CommunicationVersionDto } from './communication.dto';
import {
  CommunicationNotFoundError,
  type CommunicationRepository,
  CommunicationVersionConflictError,
} from './communication.repository';
import type {
  CommunicationActor,
  CommunicationDispatch,
  CommunicationTask,
} from './communication.types';
interface Options {
  now?: () => Date;
  id?: () => string;
}
export class CommunicationService {
  private readonly now: () => Date;
  private readonly id: () => string;
  constructor(
    private readonly repo: CommunicationRepository,
    options: Options = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.id = options.id ?? randomUUID;
  }
  list() {
    return this.repo.findAll();
  }
  async get(eventId: string) {
    const item = await this.repo.findByEventId(eventId);
    if (!item) this.notFound();
    return item;
  }
  async escalate(eventId: string, input: CommunicationVersionDto, actor: CommunicationActor) {
    const item = await this.get(eventId);
    if (item.tasks.some((task) => task.confirmStatus === '已确认'))
      throw new ConflictException({
        code: 'COMMUNICATION_ALREADY_CONFIRMED',
        message: '事件已有确认回执，不能继续升级',
      });
    if (item.escalationLevel >= 3)
      throw new ConflictException({
        code: 'COMMUNICATION_ESCALATION_LIMIT',
        message: '通信事件已达到最高升级等级',
      });
    const level = (item.escalationLevel + 1) as 1 | 2 | 3;
    const receivers: Array<[string, string, CommunicationTask['channel']]> =
      level === 1
        ? [[item.tasks[0].receiver, item.tasks[0].receiverRole, '电话语音']]
        : level === 2
          ? [['李建国', '当班班长', '电话语音']]
          : [
              ['张伟', '装置负责人', '电话语音'],
              ['陈涛', '生产调度', '短信'],
            ];
    const timestamp = this.now().toISOString();
    const appended = receivers.map(([receiver, receiverRole, channel]) => ({
      id: this.id(),
      eventId: item.eventId,
      eventTitle: item.eventTitle,
      receiver,
      receiverRole,
      channel,
      sendTime: timestamp,
      deliveryStatus: '已送达' as const,
      confirmStatus: '未确认' as const,
      retryCount: level === 1 ? 1 : 0,
      escalationLevel: level,
      sentBy: actor.actorName,
    }));
    return this.mutate(item, input.expectedVersion, {
      status: level === 3 ? '升级完成' : '待确认',
      escalationLevel: level,
      tasks: [...appended, ...item.tasks],
      updatedAt: timestamp,
    });
  }
  async confirm(taskId: string, input: CommunicationVersionDto, actor: CommunicationActor) {
    const item = await this.repo.findByTaskId(taskId);
    if (!item) this.notFound();
    const task = item.tasks.find((entry) => entry.id === taskId)!;
    if (task.deliveryStatus !== '已送达')
      throw new ConflictException({
        code: 'COMMUNICATION_NOT_DELIVERED',
        message: '任务尚未送达，不能确认',
      });
    if (task.confirmStatus === '已确认')
      throw new ConflictException({
        code: 'COMMUNICATION_ALREADY_CONFIRMED',
        message: '通信任务已确认',
      });
    const timestamp = this.now().toISOString();
    return this.mutate(item, input.expectedVersion, {
      status: '已确认',
      tasks: item.tasks.map((entry) =>
        entry.id === taskId
          ? {
              ...entry,
              confirmStatus: '已确认',
              confirmTime: timestamp,
              confirmedBy: actor.actorName,
            }
          : entry,
      ),
      updatedAt: timestamp,
    });
  }
  async receipt(taskId: string, input: CommunicationReceiptDto) {
    const item = await this.repo.findByTaskId(taskId);
    if (!item) this.notFound();
    const task = item.tasks.find((entry) => entry.id === taskId)!;
    if (task.confirmStatus === '已确认')
      throw new ConflictException({
        code: 'COMMUNICATION_ALREADY_CONFIRMED',
        message: '已确认任务不能变更送达回执',
      });
    const timestamp = this.now().toISOString();
    let tasks = item.tasks.map((entry) =>
      entry.id === taskId
        ? {
            ...entry,
            deliveryStatus: input.deliveryStatus,
            confirmStatus:
              input.deliveryStatus === '已送达' ? ('未确认' as const) : ('待确认' as const),
          }
        : entry,
    );
    if (input.deliveryStatus === '失败' && task.retryCount < 2)
      tasks = [
        {
          ...task,
          id: this.id(),
          sendTime: timestamp,
          deliveryStatus: '发送中',
          confirmStatus: '待确认',
          retryCount: task.retryCount + 1,
        },
        ...tasks,
      ];
    return this.mutate(item, input.expectedVersion, { tasks, updatedAt: timestamp });
  }
  private async mutate(
    item: CommunicationDispatch,
    expected: number | undefined,
    mutation: Parameters<CommunicationRepository['mutate']>[1],
  ) {
    try {
      return await this.repo.mutate(item.eventId, mutation, expected ?? item.version);
    } catch (error) {
      if (error instanceof CommunicationNotFoundError) this.notFound();
      if (error instanceof CommunicationVersionConflictError)
        throw new ConflictException({
          code: 'VERSION_CONFLICT',
          message: '通信记录已被其他用户更新，请刷新后重试',
        });
      throw error;
    }
  }
  private notFound(): never {
    throw new NotFoundException({
      code: 'COMMUNICATION_NOT_FOUND',
      message: '通信事件或任务不存在',
    });
  }
}
