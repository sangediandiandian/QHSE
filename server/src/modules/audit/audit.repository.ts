import type { AuditLogEntry, AuditQuery } from './audit.types';

export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');

export interface AuditRepository {
  create(entry: AuditLogEntry): Promise<AuditLogEntry>;
  findAll(query: AuditQuery): Promise<AuditLogEntry[]>;
}
