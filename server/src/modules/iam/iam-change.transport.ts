export type IamChangeKind =
  | 'user.created'
  | 'user.authorization.updated'
  | 'user.password.updated'
  | 'role.created'
  | 'role.updated'
  | 'authorization.requested'
  | 'authorization.reviewed';

export interface IamChangeEvent {
  sourceId: string;
  kind: IamChangeKind;
  subjectId: string;
  occurredAt: string;
}

export interface IamChangeTransport {
  readonly backend: 'memory' | 'redis';
  subscribe(
    handler: (event: IamChangeEvent) => Promise<void>,
    onReconnect?: () => Promise<void>,
  ): Promise<void>;
  publish(event: IamChangeEvent): Promise<void>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

export class MemoryIamChangeTransport implements IamChangeTransport {
  readonly backend = 'memory' as const;

  async subscribe(
    handler: (event: IamChangeEvent) => Promise<void>,
    onReconnect?: () => Promise<void>,
  ) {
    void handler;
    void onReconnect;
  }

  async publish(event: IamChangeEvent) {
    void event;
  }

  async ping() {}

  async close() {}
}
