import type {
  EmergencyResource,
  EmergencyResourceBatch,
  EmergencyResourceBatchAllocation,
  EmergencyResourceBatchInput,
  EmergencyResourceDispatchInput,
  EmergencyResourceInput,
  EmergencyResourceInspectionInput,
} from '@/types/qhse';

const EXPIRY_WARNING_DAYS = 30;

function parseDate(date: string) {
  return new Date(`${date}T00:00:00Z`).getTime();
}

export function getEmergencyResourceBatchStatus(
  batch: EmergencyResourceBatch,
  today: string,
): '正常' | '即将到期' | '已过期' {
  const remainingDays = Math.floor((parseDate(batch.expiryDate) - parseDate(today)) / 86400000);
  if (remainingDays < 0) return '已过期';
  if (remainingDays <= EXPIRY_WARNING_DAYS) return '即将到期';
  return '正常';
}

export function getDispatchableEmergencyResourceQuantity(resource: EmergencyResource, today: string) {
  if (!resource.batches?.length) return resource.availableQuantity;
  const batchedAvailableQuantity = resource.batches.reduce((total, batch) => total + batch.availableQuantity, 0);
  const unbatchedAvailableQuantity = Math.max(0, resource.availableQuantity - batchedAvailableQuantity);
  return unbatchedAvailableQuantity + resource.batches.reduce((total, batch) => getEmergencyResourceBatchStatus(batch, today) === '已过期'
    ? total
    : total + batch.availableQuantity, 0);
}

export function addEmergencyResourceBatch(
  resource: EmergencyResource,
  input: EmergencyResourceBatchInput,
  id: string,
): EmergencyResource {
  const batchNo = input.batchNo.trim();
  if (resource.batches?.some((batch) => batch.batchNo.toLowerCase() === batchNo.toLowerCase())) {
    throw new Error('批号已存在');
  }
  if (input.quantity <= 0) throw new Error('入库数量必须大于 0');
  const batch: EmergencyResourceBatch = {
    ...input,
    id,
    batchNo,
    availableQuantity: input.quantity,
  };
  const totalQuantity = resource.totalQuantity + input.quantity;
  return {
    ...resource,
    totalQuantity,
    availableQuantity: resource.availableQuantity + input.quantity,
    quantity: `${totalQuantity} ${resource.unit}`,
    batches: [...(resource.batches ?? []), batch],
  };
}

function getResourceStatus(dispatches: EmergencyResource['dispatches']): EmergencyResource['status'] {
  if (dispatches.some((item) => item.status === '调度中')) return '调度中';
  if (dispatches.some((item) => item.status === '已到位')) return '已到位';
  return '待命';
}

export function addEmergencyResource(
  resources: EmergencyResource[],
  input: EmergencyResourceInput,
  id: string,
): EmergencyResource[] {
  const { batchNo, receivedAt, expiryDate, ...resourceInput } = input;
  const resource: EmergencyResource = {
    ...resourceInput,
    id,
    quantity: `${input.totalQuantity} ${input.unit}`,
    availableQuantity: input.totalQuantity,
    status: '待命',
    lastInspection: '尚未检查',
    inspectionStatus: '即将到期',
    batches: [{
      id: `${id}-batch-1`,
      batchNo: batchNo.trim(),
      quantity: input.totalQuantity,
      availableQuantity: input.totalQuantity,
      receivedAt,
      expiryDate,
    }],
    dispatches: [],
    inspectionRecords: [],
  };
  return [...resources, resource];
}

export function dispatchEmergencyResource(
  resource: EmergencyResource,
  input: EmergencyResourceDispatchInput,
): EmergencyResource {
  if (resource.inspectionStatus === '需要维护') throw new Error('需要维护的资源不能调拨');
  if (input.quantity <= 0) throw new Error('调拨数量超出可用库存');
  const today = input.dispatchedAt.slice(0, 10);
  const dispatchableQuantity = getDispatchableEmergencyResourceQuantity(resource, today);
  if (input.quantity > dispatchableQuantity) {
    throw new Error(resource.batches?.length ? '有效批次库存不足' : '调拨数量超出可用库存');
  }

  let batches = resource.batches;
  let batchAllocations: EmergencyResourceBatchAllocation[] | undefined;
  if (batches?.length) {
    let remaining = input.quantity;
    batchAllocations = [...batches]
      .filter((batch) => batch.availableQuantity > 0 && getEmergencyResourceBatchStatus(batch, today) !== '已过期')
      .sort((left, right) => left.expiryDate.localeCompare(right.expiryDate))
      .flatMap((batch) => {
        if (!remaining) return [];
        const quantity = Math.min(batch.availableQuantity, remaining);
        remaining -= quantity;
        return [{ batchId: batch.id, batchNo: batch.batchNo, quantity }];
      });
    batches = batches.map((batch) => {
      const allocation = batchAllocations?.find((item) => item.batchId === batch.id);
      return allocation ? { ...batch, availableQuantity: batch.availableQuantity - allocation.quantity } : batch;
    });
  }

  const dispatches = [...resource.dispatches, {
    ...input,
    originalEta: resource.eta,
    status: '调度中' as const,
    batchAllocations,
  }];
  return {
    ...resource,
    availableQuantity: resource.availableQuantity - input.quantity,
    batches,
    status: getResourceStatus(dispatches),
    dispatches,
  };
}

export function confirmEmergencyResourceArrival(
  resource: EmergencyResource,
  dispatchId: string,
  arrivedAt: string,
): EmergencyResource {
  const dispatches = resource.dispatches.map((item) => item.id === dispatchId && item.status === '调度中'
    ? { ...item, status: '已到位' as const, arrivedAt }
    : item);
  return { ...resource, eta: '已到场', status: getResourceStatus(dispatches), dispatches };
}

export function returnEmergencyResource(
  resource: EmergencyResource,
  dispatchId: string,
  returnedAt: string,
): EmergencyResource {
  const target = resource.dispatches.find((item) => item.id === dispatchId && item.status !== '已归还');
  if (!target) return resource;
  const dispatches = resource.dispatches.map((item) => item.id === dispatchId
    ? { ...item, status: '已归还' as const, returnedAt }
    : item);
  const batches = resource.batches?.map((batch) => {
    const quantity = target.batchAllocations?.find((item) => item.batchId === batch.id)?.quantity ?? 0;
    return quantity ? { ...batch, availableQuantity: Math.min(batch.quantity, batch.availableQuantity + quantity) } : batch;
  });
  return {
    ...resource,
    availableQuantity: Math.min(resource.totalQuantity, resource.availableQuantity + target.quantity),
    eta: target.originalEta,
    status: getResourceStatus(dispatches),
    batches,
    dispatches,
  };
}

export function inspectEmergencyResource(
  resource: EmergencyResource,
  input: EmergencyResourceInspectionInput,
): EmergencyResource {
  return {
    ...resource,
    lastInspection: input.inspectedAt.slice(0, 10),
    nextInspection: input.nextInspection,
    inspectionStatus: input.result,
    inspectionRecords: [...resource.inspectionRecords, input],
  };
}

export function getActiveEmergencyResourceDispatch(resource: EmergencyResource) {
  return [...resource.dispatches].reverse().find((item) => item.status !== '已归还');
}
