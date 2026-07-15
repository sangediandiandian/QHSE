import type { EmergencyResource, ResourceMutation } from './emergency-resource.types';
export const EMERGENCY_RESOURCE_REPOSITORY = Symbol('EMERGENCY_RESOURCE_REPOSITORY');
export class ResourceNotFoundError extends Error {}
export class ResourceVersionConflictError extends Error {
  constructor(
    public expected: number,
    public actual: number,
  ) {
    super('Resource version conflict');
  }
}
export interface EmergencyResourceRepository {
  findAll(): Promise<EmergencyResource[]>;
  findById(id: string): Promise<EmergencyResource | undefined>;
  findByCode(code: string): Promise<EmergencyResource | undefined>;
  create(resource: EmergencyResource): Promise<EmergencyResource>;
  mutate(
    id: string,
    mutation: ResourceMutation,
    expectedVersion: number,
  ): Promise<EmergencyResource>;
}
