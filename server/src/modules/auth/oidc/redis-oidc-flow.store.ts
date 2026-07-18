import { createClient } from 'redis';
import type { OidcFlowStore, OidcLoginResult, OidcTransaction } from './oidc-flow.store';

export class RedisOidcFlowStore implements OidcFlowStore {
  readonly backend = 'redis' as const;
  private readonly client;
  private connectPromise?: Promise<void>;

  constructor(url: string) {
    this.client = createClient({
      url,
      socket: { connectTimeout: 2_000, reconnectStrategy: false },
      disableOfflineQueue: true,
    });
    this.client.on('error', () => undefined);
  }

  async putTransaction(id: string, value: OidcTransaction, ttlMs: number) {
    await this.put(this.key('transaction', id), value, ttlMs);
  }

  async takeTransaction(id: string) {
    return this.take<OidcTransaction>(this.key('transaction', id));
  }

  async putResult(id: string, value: OidcLoginResult, ttlMs: number) {
    await this.put(this.key('result', id), value, ttlMs);
  }

  async takeResult(id: string) {
    return this.take<OidcLoginResult>(this.key('result', id));
  }

  async ping() {
    await this.connect();
    await this.client.ping();
  }

  async close() {
    if (this.client.isOpen) await this.client.close();
  }

  private async put(key: string, value: unknown, ttlMs: number) {
    await this.connect();
    await this.client.set(key, JSON.stringify(value), { PX: ttlMs });
  }

  private async take<T>(key: string) {
    await this.connect();
    const value = await this.client.sendCommand(['GETDEL', key]);
    return typeof value === 'string' ? (JSON.parse(value) as T) : undefined;
  }

  private key(type: string, id: string) {
    return `qhse:oidc:${type}:${id}`;
  }

  private async connect() {
    if (this.client.isReady) return;
    this.connectPromise ??= this.client.connect().then(() => undefined);
    try {
      await this.connectPromise;
    } catch (error) {
      this.connectPromise = undefined;
      throw error;
    }
  }
}
