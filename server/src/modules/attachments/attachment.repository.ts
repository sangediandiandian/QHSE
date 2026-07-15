import type { AttachmentBinding, StoredObject } from './attachment.types';

export const ATTACHMENT_REPOSITORY = Symbol('ATTACHMENT_REPOSITORY');

export interface AttachmentRepository {
  create(object: StoredObject): Promise<StoredObject>;
  findById(id: string): Promise<StoredObject | undefined>;
  bind(id: string, binding: AttachmentBinding): Promise<StoredObject | undefined>;
}
