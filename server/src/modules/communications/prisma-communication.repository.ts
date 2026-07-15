import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CommunicationNotFoundError,
  type CommunicationRepository,
  CommunicationVersionConflictError,
} from './communication.repository';
import type {
  CommunicationDispatch,
  CommunicationMutation,
  CommunicationTask,
} from './communication.types';
type Record = Awaited<ReturnType<PrismaService['communicationDispatch']['findFirstOrThrow']>>;
const mapRecord = (record: Record): CommunicationDispatch => ({
  ...record,
  eventLevel: record.eventLevel as CommunicationDispatch['eventLevel'],
  status: record.status as CommunicationDispatch['status'],
  escalationLevel: record.escalationLevel as CommunicationDispatch['escalationLevel'],
  tasks: record.tasks as unknown as CommunicationTask[],
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});
@Injectable()
export class PrismaCommunicationRepository implements CommunicationRepository {
  constructor(private readonly prisma: PrismaService) {}
  async findAll() {
    return (
      await this.prisma.communicationDispatch.findMany({ orderBy: { updatedAt: 'desc' } })
    ).map(mapRecord);
  }
  async findByEventId(eventId: string) {
    const item = await this.prisma.communicationDispatch.findUnique({ where: { eventId } });
    return item ? mapRecord(item) : undefined;
  }
  async findByTaskId(taskId: string) {
    const items = await this.findAll();
    return items.find((item) => item.tasks.some((task) => task.id === taskId));
  }
  async mutate(eventId: string, mutation: CommunicationMutation, expectedVersion: number) {
    const result = await this.prisma.communicationDispatch.updateMany({
      where: { eventId, version: expectedVersion },
      data: {
        status: mutation.status,
        escalationLevel: mutation.escalationLevel,
        tasks: mutation.tasks as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
        updatedAt: new Date(mutation.updatedAt),
      },
    });
    if (!result.count) {
      if (!(await this.findByEventId(eventId))) throw new CommunicationNotFoundError();
      throw new CommunicationVersionConflictError();
    }
    return this.findByEventId(eventId) as Promise<CommunicationDispatch>;
  }
}
