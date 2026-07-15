import { emergencyResourceSeed } from './emergency-resource.seed';
import {
  type EmergencyResourceRepository,
  ResourceNotFoundError,
  ResourceVersionConflictError,
} from './emergency-resource.repository';
import type { EmergencyResource, ResourceMutation } from './emergency-resource.types';
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
export class InMemoryEmergencyResourceRepository implements EmergencyResourceRepository {
  private records = new Map(emergencyResourceSeed.map((r) => [r.id, clone(r)]));
  async findAll() {
    return [...this.records.values()].map(clone);
  }
  async findById(id: string) {
    const r = this.records.get(id);
    return r ? clone(r) : undefined;
  }
  async findByCode(code: string) {
    const r = [...this.records.values()].find((x) => x.code === code);
    return r ? clone(r) : undefined;
  }
  async create(r: EmergencyResource) {
    this.records.set(r.id, clone(r));
    return clone(r);
  }
  async mutate(id: string, m: ResourceMutation, expected: number) {
    const r = this.records.get(id);
    if (!r) throw new ResourceNotFoundError();
    if (r.version !== expected) throw new ResourceVersionConflictError(expected, r.version);
    const next: EmergencyResource = {
      ...r,
      totalQuantity: m.totalQuantity ?? r.totalQuantity,
      availableQuantity: m.availableQuantity ?? r.availableQuantity,
      status: m.status ?? r.status,
      lastInspection: m.lastInspection ?? r.lastInspection,
      nextInspection: m.nextInspection ?? r.nextInspection,
      inspectionStatus: m.inspectionStatus ?? r.inspectionStatus,
      batches: m.batches ?? r.batches,
      dispatches: m.dispatches ?? r.dispatches,
      inspectionRecords: m.inspection
        ? [...r.inspectionRecords, m.inspection]
        : r.inspectionRecords,
      version: r.version + 1,
      quantity: `${m.totalQuantity ?? r.totalQuantity} ${r.unit}`,
    };
    this.records.set(id, clone(next));
    return clone(next);
  }
}
