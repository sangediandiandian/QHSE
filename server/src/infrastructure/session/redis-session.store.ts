import { createClient } from 'redis';
import type { SessionStore, StoredSession } from './session-store';

const CREATE_SESSION_SCRIPT = `
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
redis.call('ZADD', KEYS[2], ARGV[3], ARGV[4])
redis.call('PEXPIRE', KEYS[2], ARGV[2])
local count = redis.call('ZCARD', KEYS[2])
local excess = count - tonumber(ARGV[5])
if excess > 0 then
  local oldest = redis.call('ZRANGE', KEYS[2], 0, excess - 1)
  for _, token in ipairs(oldest) do
    redis.call('DEL', ARGV[6] .. token)
    redis.call('ZREM', KEYS[2], token)
  end
end
return 1
`;

export class RedisSessionStore implements SessionStore {
  readonly backend = 'redis' as const;
  private readonly client;
  private connectPromise?: Promise<void>;
  private readonly prefix = 'qhse:session:';

  constructor(url: string) {
    this.client = createClient({
      url,
      socket: { connectTimeout: 2_000, reconnectStrategy: false },
      disableOfflineQueue: true,
    });
    this.client.on('error', () => undefined);
  }

  async create(token: string, session: StoredSession, ttlMs: number, maxUserSessions: number) {
    await this.connect();
    await this.client.eval(CREATE_SESSION_SCRIPT, {
      keys: [this.key(token), this.userKey(session.principal.userId)],
      arguments: [
        JSON.stringify(session),
        String(ttlMs),
        String(session.createdAt),
        token,
        String(maxUserSessions),
        this.prefix,
      ],
    });
  }

  async get(token: string): Promise<StoredSession | undefined> {
    await this.connect();
    const value = await this.client.get(this.key(token));
    return value === null ? undefined : (JSON.parse(value) as StoredSession);
  }

  async delete(token: string) {
    await this.connect();
    const session = await this.get(token);
    const transaction = this.client.multi().del(this.key(token));
    if (session) transaction.zRem(this.userKey(session.principal.userId), token);
    await transaction.exec();
  }

  async deleteUser(userId: string, exceptToken?: string) {
    await this.connect();
    const userKey = this.userKey(userId);
    const tokens = await this.client.zRange(userKey, 0, -1);
    const revoked = tokens.filter((token) => token !== exceptToken);
    if (!revoked.length) return;
    const transaction = this.client.multi();
    revoked.forEach((token) => transaction.del(this.key(token)));
    transaction.zRem(userKey, revoked);
    await transaction.exec();
  }

  async ping() {
    await this.connect();
    await this.client.ping();
  }

  async close() {
    if (this.client.isOpen) await this.client.close();
  }

  private key(token: string) {
    return `${this.prefix}${token}`;
  }

  private userKey(userId: string) {
    return `qhse:user-sessions:${userId}`;
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
