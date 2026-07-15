import type { AuthPrincipal } from '../../modules/iam/iam.types';

export interface StoredSession {
  principal: AuthPrincipal;
  createdAt: number;
  expiresAt: number;
}

export interface SessionStore {
  readonly backend: 'memory' | 'redis';
  create(
    token: string,
    session: StoredSession,
    ttlMs: number,
    maxUserSessions: number,
  ): Promise<void>;
  get(token: string): Promise<StoredSession | undefined>;
  delete(token: string): Promise<void>;
  close(): Promise<void>;
}
