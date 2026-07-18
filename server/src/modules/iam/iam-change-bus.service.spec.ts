/** @jest-environment node */

import { IamChangeBusService } from './iam-change-bus.service';
import type { IamChangeEvent, IamChangeTransport } from './iam-change.transport';
import { IamService } from './iam.service';
import { InMemoryIamRepository } from './in-memory-iam.repository';

class TestIamChangeHub {
  readonly handlers: Array<(event: IamChangeEvent) => Promise<void>> = [];
  readonly reconnectHandlers: Array<() => Promise<void>> = [];
}

class TestIamChangeTransport implements IamChangeTransport {
  readonly backend = 'memory' as const;

  constructor(
    private readonly hub: TestIamChangeHub,
    private readonly failPublish = false,
  ) {}

  async subscribe(
    handler: (event: IamChangeEvent) => Promise<void>,
    _onReconnect?: () => Promise<void>,
  ) {
    this.hub.handlers.push(handler);
    if (_onReconnect) this.hub.reconnectHandlers.push(_onReconnect);
  }

  async publish(event: IamChangeEvent) {
    if (this.failPublish) throw new Error('transport unavailable');
    await Promise.all(this.hub.handlers.map((handler) => handler(event)));
  }

  async ping() {
    if (this.failPublish) throw new Error('transport unavailable');
  }

  async close() {}
}

describe('IamChangeBusService', () => {
  test('远端 IAM 变更触发其他实例重载共享仓储快照', async () => {
    const repository = new InMemoryIamRepository();
    const hub = new TestIamChangeHub();
    const first = new IamService(
      repository,
      undefined,
      undefined,
      new IamChangeBusService(new TestIamChangeTransport(hub), () => 'instance-a'),
    );
    const secondBus = new IamChangeBusService(new TestIamChangeTransport(hub), () => 'instance-b');
    const second = new IamService(repository, undefined, undefined, secondBus);
    await first.onModuleInit();
    await second.onModuleInit();

    await first.updateUserAuthorization(
      'user-operator',
      {
        status: 'enabled',
        organizationId: 'org-storage',
        roleCodes: ['operator'],
        areaIds: ['area-05'],
        expectedVersion: 1,
      },
      'user-admin',
    );

    expect(second.listUsers()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'user-operator',
          organizationId: 'org-storage',
          areaIds: ['area-05'],
          version: 2,
        }),
      ]),
    );
    expect(secondBus.snapshot()).toMatchObject({ received: 1, failures: 0, status: 'ready' });

    const current = second.findUserById('user-operator')!;
    await repository.updateUserAuthorization(
      { ...current, organizationId: 'org-fcc', areaIds: ['area-02'] },
      2,
    );
    await Promise.all(hub.reconnectHandlers.map((handler) => handler()));
    expect(second.listUsers()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'user-operator',
          organizationId: 'org-fcc',
          version: 3,
        }),
      ]),
    );
    expect(secondBus.snapshot()).toMatchObject({ reconciliations: 1, failures: 0 });
  });

  test('发布失败记录降级但不把已完成业务事务伪装成失败', async () => {
    const bus = new IamChangeBusService(
      new TestIamChangeTransport(new TestIamChangeHub(), true),
      () => 'instance-a',
    );

    await expect(bus.publish('role.updated', 'role-1')).resolves.toBeUndefined();
    expect(bus.snapshot()).toMatchObject({
      backend: 'memory',
      status: 'degraded',
      published: 0,
      failures: 1,
    });
  });
});
