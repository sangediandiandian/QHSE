import type { AuditRepository } from './audit.repository';
import type { AuditLogEntry, AuditQuery } from './audit.types';

export class InMemoryAuditRepository implements AuditRepository {
  private readonly entries: AuditLogEntry[] = [];

  async create(entry: AuditLogEntry) {
    this.entries.unshift(structuredClone(entry));
    return structuredClone(entry);
  }

  async findAll(query: AuditQuery) {
    return this.entries
      .filter((item) => !query.actorId || item.actorId === query.actorId)
      .filter((item) => !query.action || item.action.includes(query.action))
      .filter((item) => !query.result || item.result === query.result)
      .slice(0, query.limit ?? 100)
      .map((item) => structuredClone(item));
  }
}
