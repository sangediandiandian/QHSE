import { Injectable } from '@nestjs/common';
import type { AttachmentRepository } from './attachment.repository';
import type { AttachmentBinding, StoredObject } from './attachment.types';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

@Injectable()
export class InMemoryAttachmentRepository implements AttachmentRepository {
  private readonly objects = new Map<string, StoredObject>();

  async create(object: StoredObject) {
    this.objects.set(object.id, clone(object));
    return clone(object);
  }

  async findById(id: string) {
    const object = this.objects.get(id);
    return object ? clone(object) : undefined;
  }

  async bind(id: string, binding: AttachmentBinding) {
    const object = this.objects.get(id);
    if (!object || object.status !== 'uploaded') return undefined;
    const bound: StoredObject = {
      ...object,
      ...binding,
      status: 'bound',
    };
    this.objects.set(id, clone(bound));
    return clone(bound);
  }
}
