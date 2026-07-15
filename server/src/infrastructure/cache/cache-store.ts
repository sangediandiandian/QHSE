export interface CacheStore {
  readonly backend: 'memory' | 'redis';
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  deleteByPrefix(prefix: string): Promise<void>;
  ping(): Promise<void>;
  close(): Promise<void>;
}
