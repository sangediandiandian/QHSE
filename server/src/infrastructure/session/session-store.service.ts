import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { SessionStore, StoredSession } from './session-store';

@Injectable()
export class SessionStoreService implements OnModuleDestroy {
  private operations = 0;
  private failures = 0;
  private lastErrorAt?: string;
  private lastSuccessAt?: string;

  constructor(private readonly store: SessionStore) {}

  async create(token: string, session: StoredSession, ttlMs: number, maxUserSessions: number) {
    return this.execute(() => this.store.create(token, session, ttlMs, maxUserSessions));
  }

  async get(token: string) {
    return this.execute(() => this.store.get(token));
  }

  async delete(token: string) {
    return this.execute(() => this.store.delete(token));
  }

  async deleteUser(userId: string, exceptToken?: string) {
    return this.execute(() => this.store.deleteUser(userId, exceptToken));
  }

  async check() {
    await this.execute(() => this.store.ping());
  }

  snapshot() {
    const degraded = Boolean(
      this.lastErrorAt && (!this.lastSuccessAt || this.lastErrorAt > this.lastSuccessAt),
    );
    return {
      backend: this.store.backend,
      status: degraded ? 'degraded' : 'ready',
      operations: this.operations,
      failures: this.failures,
      lastErrorAt: this.lastErrorAt,
      lastSuccessAt: this.lastSuccessAt,
    };
  }

  async onModuleDestroy() {
    await this.store.close();
  }

  private async execute<T>(operation: () => Promise<T>) {
    try {
      const result = await operation();
      this.operations += 1;
      this.lastSuccessAt = new Date().toISOString();
      return result;
    } catch (error) {
      this.failures += 1;
      this.lastErrorAt = new Date().toISOString();
      throw error;
    }
  }
}
