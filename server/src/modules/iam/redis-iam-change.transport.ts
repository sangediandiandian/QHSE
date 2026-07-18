import { createClient } from 'redis';
import type { IamChangeEvent, IamChangeTransport } from './iam-change.transport';

const CHANNEL = 'qhse:iam:changes';

export class RedisIamChangeTransport implements IamChangeTransport {
  readonly backend = 'redis' as const;
  private readonly publisher;
  private readonly subscriber;
  private readonly onError: () => void;
  private active = false;
  private onReconnect?: () => Promise<void>;

  constructor(url: string, onError: () => void = () => undefined) {
    this.onError = onError;
    const options = {
      url,
      socket: {
        connectTimeout: 2_000,
        reconnectStrategy: (retries: number) =>
          retries < 5 ? Math.min(100 * 2 ** retries, 1_000) : new Error('Redis reconnect failed'),
      },
      disableOfflineQueue: true,
    } as const;
    this.publisher = createClient(options);
    this.subscriber = createClient(options);
    this.publisher.on('error', onError);
    this.subscriber.on('error', onError);
    this.subscriber.on('ready', () => {
      if (this.active && this.onReconnect) {
        void this.onReconnect().catch(this.onError);
      }
    });
  }

  async subscribe(
    handler: (event: IamChangeEvent) => Promise<void>,
    onReconnect?: () => Promise<void>,
  ) {
    this.onReconnect = onReconnect;
    await this.subscriber.connect();
    await this.subscriber.subscribe(CHANNEL, (message) => {
      void Promise.resolve()
        .then(() => handler(JSON.parse(message) as IamChangeEvent))
        .catch(this.onError);
    });
    this.active = true;
  }

  async publish(event: IamChangeEvent) {
    if (!this.publisher.isReady) await this.publisher.connect();
    await this.publisher.publish(CHANNEL, JSON.stringify(event));
  }

  async ping() {
    if (!this.publisher.isReady) await this.publisher.connect();
    await this.publisher.ping();
  }

  async close() {
    this.active = false;
    if (this.subscriber.isOpen) {
      await this.subscriber.unsubscribe(CHANNEL);
      await this.subscriber.close();
    }
    if (this.publisher.isOpen) await this.publisher.close();
  }
}
