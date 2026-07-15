import { randomUUID } from 'node:crypto';
import type { AuditRepository } from './audit.repository';
import type { AuditLogEntry, AuditQuery } from './audit.types';

export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  record(input: Omit<AuditLogEntry, 'id' | 'createdAt'>) {
    return this.repository.create({
      ...input,
      id: randomUUID(),
      createdAt: new Date(),
    });
  }

  list(query: AuditQuery) {
    return this.repository.findAll(query);
  }
}
