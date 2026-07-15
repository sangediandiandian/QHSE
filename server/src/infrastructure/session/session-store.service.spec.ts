/** @jest-environment node */

import { MemorySessionStore } from './memory-session.store';
import { SessionStoreService } from './session-store.service';
import type { AuthPrincipal } from '../../modules/iam/iam.types';

const principal = (userId: string) => ({ userId }) as AuthPrincipal;

describe('SessionStoreService', () => {
  test('共享存储允许不同服务实例读取同一会话', async () => {
    const store = new MemorySessionStore(() => 0);
    const first = new SessionStoreService(store);
    const second = new SessionStoreService(store);
    await first.create(
      'token',
      { principal: principal('user-a'), createdAt: 1, expiresAt: 100 },
      99,
      5,
    );
    await expect(second.get('token')).resolves.toMatchObject({ principal: { userId: 'user-a' } });
  });

  test('同一用户只保留最新五个会话', async () => {
    const service = new SessionStoreService(new MemorySessionStore(() => 0));
    for (let index = 0; index < 6; index += 1) {
      await service.create(
        `token-${index}`,
        { principal: principal('user-a'), createdAt: index, expiresAt: 100 },
        100,
        5,
      );
    }
    await expect(service.get('token-0')).resolves.toBeUndefined();
    await expect(service.get('token-5')).resolves.toBeDefined();
  });

  test('过期与主动删除的会话无法读取', async () => {
    let now = 0;
    const service = new SessionStoreService(new MemorySessionStore(() => now));
    await service.create(
      'expired',
      { principal: principal('user-a'), createdAt: 0, expiresAt: 10 },
      10,
      5,
    );
    now = 11;
    await expect(service.get('expired')).resolves.toBeUndefined();
    await service.create(
      'logout',
      { principal: principal('user-a'), createdAt: 11, expiresAt: 20 },
      9,
      5,
    );
    await service.delete('logout');
    await expect(service.get('logout')).resolves.toBeUndefined();
  });
});
