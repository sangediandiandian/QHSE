export interface ResourceBatch {
  id: string;
  batchNo: string;
  quantity: number;
  availableQuantity: number;
  receivedAt: string;
  expiryDate: string;
}
export interface BatchAllocation {
  batchId: string;
  batchNo: string;
  quantity: number;
}
export interface ResourceDispatch {
  id: string;
  eventName: string;
  destination: string;
  quantity: number;
  operatorId: string;
  operator: string;
  dispatchedAt: string;
  originalEta: string;
  arrivedAt?: string;
  returnedAt?: string;
  status: '调度中' | '已到位' | '已归还';
  batchAllocations?: BatchAllocation[];
}
export interface ResourceInspection {
  id: string;
  inspectorId: string;
  inspector: string;
  inspectedAt: string;
  result: '检查合格' | '即将到期' | '需要维护';
  nextInspection: string;
  note: string;
}
export interface EmergencyResource {
  id: string;
  code: string;
  name: string;
  type: '消防' | '气防' | '医疗' | '物资';
  quantity: string;
  totalQuantity: number;
  availableQuantity: number;
  unit: string;
  location: string;
  eta: string;
  status: '待命' | '调度中' | '已到位';
  owner: string;
  contact: string;
  lastInspection: string;
  nextInspection: string;
  inspectionStatus: '检查合格' | '即将到期' | '需要维护';
  batches: ResourceBatch[];
  dispatches: ResourceDispatch[];
  inspectionRecords: ResourceInspection[];
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface ResourceMutation {
  totalQuantity?: number;
  availableQuantity?: number;
  eta?: string;
  status?: EmergencyResource['status'];
  lastInspection?: string;
  nextInspection?: string;
  inspectionStatus?: EmergencyResource['inspectionStatus'];
  batches?: ResourceBatch[];
  dispatches?: ResourceDispatch[];
  inspection?: ResourceInspection;
  updatedAt: string;
}
export interface ResourceActor {
  actorId: string;
  actorName: string;
}
