export type AuditResult = 'success' | 'failure';

export interface AuditLogEntry {
  id: string;
  requestId: string;
  actorId?: string;
  actorName?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  result: AuditResult;
  method: string;
  path: string;
  ip?: string;
  durationMs: number;
  detail?: Record<string, unknown>;
  createdAt: Date;
}

export interface AuditQuery {
  actorId?: string;
  action?: string;
  result?: AuditResult;
  limit?: number;
}

export interface AuditMetadata {
  action: string;
  resourceType: string;
  resourceIdParam?: string;
  includeUsername?: boolean;
}
