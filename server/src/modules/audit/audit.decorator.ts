import { SetMetadata } from '@nestjs/common';
import type { AuditMetadata } from './audit.types';

export const AUDIT_ACTION_KEY = 'auditAction';
export const AuditAction = (metadata: AuditMetadata) => SetMetadata(AUDIT_ACTION_KEY, metadata);
