import type {
  EmergencyResource,
  EmergencyResourceDispatchInput,
  EmergencyResourceInput,
  EmergencyResourceInspectionInput,
} from '@/types/qhse';

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
  const resource: EmergencyResource = {
    ...input,
    id,
    quantity: `${input.totalQuantity} ${input.unit}`,
    availableQuantity: input.totalQuantity,
    status: '待命',
    lastInspection: '尚未检查',
    inspectionStatus: '即将到期',
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
  if (input.quantity <= 0 || input.quantity > resource.availableQuantity) throw new Error('调拨数量超出可用库存');
  const dispatches = [...resource.dispatches, { ...input, originalEta: resource.eta, status: '调度中' as const }];
  return {
    ...resource,
    availableQuantity: resource.availableQuantity - input.quantity,
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
  return {
    ...resource,
    availableQuantity: Math.min(resource.totalQuantity, resource.availableQuantity + target.quantity),
    eta: target.originalEta,
    status: getResourceStatus(dispatches),
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
