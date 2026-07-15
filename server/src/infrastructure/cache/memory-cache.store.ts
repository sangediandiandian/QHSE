import type { CacheStore } from './cache-store';

interface CacheEntry {
  value: string;
  expiresAt: number;
}

export class MemoryCacheStore implements CacheStore {
  readonly backend = 'memory' as const;
  private readonly entries = new Map<string, CacheEntry>();

  constructor(private readonly now: () => number = Date.now) {}

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return JSON.parse(entry.value) as T;
  }

  async set<T>(key: string, value: T, ttlMs: number) {
    this.entries.set(key, { value: JSON.stringify(value), expiresAt: this.now() + ttlMs });
  }

  async deleteByPrefix(prefix: string) {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) this.entries.delete(key);
    }
  }

  async ping() {}

  async close() {
    this.entries.clear();
  }
}
