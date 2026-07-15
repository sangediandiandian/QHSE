import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  AddResourceBatchDto,
  CreateResourceDto,
  DispatchResourceDto,
  InspectResourceDto,
  ResourceVersionDto,
} from './emergency-resource.dto';
import {
  type EmergencyResourceRepository,
  ResourceNotFoundError,
  ResourceVersionConflictError,
} from './emergency-resource.repository';
import type {
  BatchAllocation,
  EmergencyResource,
  ResourceActor,
  ResourceMutation,
} from './emergency-resource.types';
interface Options {
  now?: () => Date;
  id?: () => string;
}
export class EmergencyResourceService {
  private readonly now: () => Date;
  private readonly id: () => string;
  constructor(
    private readonly repo: EmergencyResourceRepository,
    options: Options = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.id = options.id ?? randomUUID;
  }
  list() {
    return this.repo.findAll();
  }
  async get(id: string) {
    const resource = await this.repo.findById(id);
    if (!resource) this.notFound();
    return resource;
  }
  async create(input: CreateResourceDto) {
    const code = input.code.trim().toUpperCase();
    if (await this.repo.findByCode(code))
      throw new ConflictException({ code: 'RESOURCE_CODE_EXISTS', message: '资源编号已存在' });
    validateDates(input.receivedAt, input.expiryDate);
    const timestamp = this.now().toISOString();
    const id = this.id();
    return this.repo.create({
      id,
      code,
      name: input.name.trim(),
      type: input.type,
      quantity: `${input.totalQuantity} ${input.unit}`,
      totalQuantity: input.totalQuantity,
      availableQuantity: input.totalQuantity,
      unit: input.unit.trim(),
      location: input.location.trim(),
      eta: input.eta.trim(),
      status: '待命',
      owner: input.owner.trim(),
      contact: input.contact.trim(),
      lastInspection: '尚未检查',
      nextInspection: input.nextInspection,
      inspectionStatus: '即将到期',
      batches: [
        {
          id: this.id(),
          batchNo: input.batchNo.trim(),
          quantity: input.totalQuantity,
          availableQuantity: input.totalQuantity,
          receivedAt: input.receivedAt,
          expiryDate: input.expiryDate,
        },
      ],
      dispatches: [],
      inspectionRecords: [],
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
  async addBatch(id: string, input: AddResourceBatchDto) {
    const resource = await this.get(id);
    validateDates(input.receivedAt, input.expiryDate);
    const batchNo = input.batchNo.trim();
    if (resource.batches.some((item) => item.batchNo.toLowerCase() === batchNo.toLowerCase()))
      throw new ConflictException({ code: 'RESOURCE_BATCH_EXISTS', message: '批号已存在' });
    return this.mutate(resource, input.expectedVersion, {
      totalQuantity: resource.totalQuantity + input.quantity,
      availableQuantity: resource.availableQuantity + input.quantity,
      batches: [
        ...resource.batches,
        {
          id: this.id(),
          batchNo,
          quantity: input.quantity,
          availableQuantity: input.quantity,
          receivedAt: input.receivedAt,
          expiryDate: input.expiryDate,
        },
      ],
      updatedAt: this.now().toISOString(),
    });
  }
  async dispatch(id: string, input: DispatchResourceDto, actor: ResourceActor) {
    const resource = await this.get(id);
    if (resource.inspectionStatus === '需要维护')
      throw new ConflictException({
        code: 'RESOURCE_MAINTENANCE_REQUIRED',
        message: '需要维护的资源不能调拨',
      });
    if (resource.dispatches.some((item) => item.status !== '已归还'))
      throw new ConflictException({
        code: 'RESOURCE_ACTIVE_DISPATCH',
        message: '资源已有未归还调拨任务',
      });
    const timestamp = this.now().toISOString();
    const today = timestamp.slice(0, 10);
    let remaining = input.quantity;
    const allocations: BatchAllocation[] = [];
    for (const batch of [...resource.batches]
      .filter((item) => item.availableQuantity > 0 && item.expiryDate >= today)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))) {
      if (!remaining) break;
      const quantity = Math.min(batch.availableQuantity, remaining);
      allocations.push({ batchId: batch.id, batchNo: batch.batchNo, quantity });
      remaining -= quantity;
    }
    if (remaining)
      throw new BadRequestException({
        code: 'RESOURCE_STOCK_INSUFFICIENT',
        message: '有效批次库存不足',
      });
    const batches = resource.batches.map((batch) => {
      const allocation = allocations.find((item) => item.batchId === batch.id);
      return allocation
        ? { ...batch, availableQuantity: batch.availableQuantity - allocation.quantity }
        : batch;
    });
    const dispatch = {
      id: this.id(),
      eventName: input.eventName.trim(),
      destination: input.destination.trim(),
      quantity: input.quantity,
      operatorId: actor.actorId,
      operator: actor.actorName,
      dispatchedAt: timestamp,
      originalEta: resource.eta,
      status: '调度中' as const,
      batchAllocations: allocations,
    };
    return this.mutate(resource, input.expectedVersion, {
      availableQuantity: resource.availableQuantity - input.quantity,
      status: '调度中',
      batches,
      dispatches: [...resource.dispatches, dispatch],
      updatedAt: timestamp,
    });
  }
  async arrive(id: string, dispatchId: string, input: ResourceVersionDto) {
    const resource = await this.get(id);
    const target = resource.dispatches.find((item) => item.id === dispatchId);
    if (!target || target.status !== '调度中') this.dispatchState();
    const timestamp = this.now().toISOString();
    return this.mutate(resource, input.expectedVersion, {
      eta: '已到场',
      status: '已到位',
      dispatches: resource.dispatches.map((item) =>
        item.id === dispatchId ? { ...item, status: '已到位', arrivedAt: timestamp } : item,
      ),
      updatedAt: timestamp,
    });
  }
  async return(id: string, dispatchId: string, input: ResourceVersionDto) {
    const resource = await this.get(id);
    const target = resource.dispatches.find((item) => item.id === dispatchId);
    if (!target || target.status !== '已到位') this.dispatchState();
    const timestamp = this.now().toISOString();
    const batches = resource.batches.map((batch) => {
      const quantity =
        target.batchAllocations?.find((item) => item.batchId === batch.id)?.quantity ?? 0;
      return quantity
        ? {
            ...batch,
            availableQuantity: Math.min(batch.quantity, batch.availableQuantity + quantity),
          }
        : batch;
    });
    return this.mutate(resource, input.expectedVersion, {
      availableQuantity: Math.min(
        resource.totalQuantity,
        resource.availableQuantity + target.quantity,
      ),
      eta: target.originalEta,
      status: '待命',
      batches,
      dispatches: resource.dispatches.map((item) =>
        item.id === dispatchId ? { ...item, status: '已归还', returnedAt: timestamp } : item,
      ),
      updatedAt: timestamp,
    });
  }
  async inspect(id: string, input: InspectResourceDto, actor: ResourceActor) {
    const resource = await this.get(id);
    const timestamp = this.now().toISOString();
    return this.mutate(resource, input.expectedVersion, {
      lastInspection: timestamp.slice(0, 10),
      nextInspection: input.nextInspection,
      inspectionStatus: input.result,
      inspection: {
        id: this.id(),
        inspectorId: actor.actorId,
        inspector: actor.actorName,
        inspectedAt: timestamp,
        result: input.result,
        nextInspection: input.nextInspection,
        note: input.note.trim(),
      },
      updatedAt: timestamp,
    });
  }
  private async mutate(
    resource: EmergencyResource,
    expected: number | undefined,
    mutation: ResourceMutation,
  ) {
    try {
      return await this.repo.mutate(resource.id, mutation, expected ?? resource.version);
    } catch (error) {
      if (error instanceof ResourceNotFoundError) this.notFound();
      if (error instanceof ResourceVersionConflictError)
        throw new ConflictException({
          code: 'VERSION_CONFLICT',
          message: '资源库存已被其他用户更新，请刷新后重试',
        });
      throw error;
    }
  }
  private dispatchState(): never {
    throw new ConflictException({
      code: 'RESOURCE_DISPATCH_STATE_CONFLICT',
      message: '调拨任务当前状态不能执行该操作',
    });
  }
  private notFound(): never {
    throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: '应急资源不存在' });
  }
}
function validateDates(receivedAt: string, expiryDate: string) {
  if (expiryDate <= receivedAt)
    throw new BadRequestException({
      code: 'RESOURCE_BATCH_DATE_INVALID',
      message: '批次有效期必须晚于入库日期',
    });
}
