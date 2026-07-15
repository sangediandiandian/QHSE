import type { SessionStore, StoredSession } from './session-store';

export class MemorySessionStore implements SessionStore {
  readonly backend = 'memory' as const;
  private readonly sessions = new Map<string, StoredSession>();

  constructor(private readonly now: () => number = Date.now) {}

  async create(token: string, session: StoredSession, _ttlMs: number, maxUserSessions: number) {
    this.removeExpired();
    const existing = [...this.sessions.entries()]
      .filter(([, item]) => item.principal.userId === session.principal.userId)
      .sort((a, b) => a[1].createdAt - b[1].createdAt);
    while (existing.length >= maxUserSessions) this.sessions.delete(existing.shift()![0]);
    this.sessions.set(token, structuredClone(session));
  }

  async get(token: string) {
    const session = this.sessions.get(token);
    if (!session) return undefined;
    if (session.expiresAt <= this.now()) {
      this.sessions.delete(token);
      return undefined;
    }
    return structuredClone(session);
  }

  async delete(token: string) {
    this.sessions.delete(token);
  }

  async ping() {}

  async close() {
    this.sessions.clear();
  }

  private removeExpired() {
    for (const [token, session] of this.sessions) {
      if (session.expiresAt <= this.now()) this.sessions.delete(token);
    }
  }
}
