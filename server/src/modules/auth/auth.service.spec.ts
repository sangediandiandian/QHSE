/** @jest-environment node */

import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { IamService } from '../iam/iam.service';
import { AuthService } from './auth.service';
import { SessionStoreService } from '../../infrastructure/session/session-store.service';
import type { SessionStore } from '../../infrastructure/session/session-store';

describe('AuthService', () => {
  test('登录后返回随机会话和 QHSE 权限', async () => {
    const service = new AuthService(new IamService());
    const result = await service.login('qhse', 'ant.design');
    expect(result.accessToken).toHaveLength(64);
    expect(result.user).toMatchObject({
      username: 'qhse',
      dataScope: 'all',
    });
    expect(result.user.permissions).toEqual(
      expect.arrayContaining(['risk:read', 'risk:assess', 'risk:controls:update', 'audit:read']),
    );
    await expect(service.authenticate(result.accessToken)).resolves.toMatchObject({
      userId: 'user-qhse',
    });
  });

  test('装置负责人只获得授权区域', async () => {
    const result = await new AuthService(new IamService()).login('unit_manager', 'ant.design');
    expect(result.user).toMatchObject({
      dataScope: 'assigned_areas',
      areaIds: ['area-02'],
    });
    expect(result.user.permissions).toEqual(
      expect.arrayContaining(['warning:handle', 'warning:close']),
    );
    const operator = await new AuthService(new IamService()).login('operator', 'ant.design');
    expect(operator.user.permissions).toContain('warning:handle');
    expect(operator.user.permissions).not.toContain('warning:close');
  });

  test('错误密码被拒绝且不会返回用户信息', async () => {
    await expect(new AuthService(new IamService()).login('admin', 'wrong')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  test('退出后会话立即失效', async () => {
    const service = new AuthService(new IamService());
    const result = await service.login('leader', 'ant.design');
    await service.logout(result.accessToken);
    await expect(service.authenticate(result.accessToken)).rejects.toThrow(UnauthorizedException);
  });

  test('授权变更立即作用于现有会话，停用后会话失效', async () => {
    const iam = new IamService();
    const service = new AuthService(iam);
    const result = await service.login('operator', 'ant.design');
    iam.updateUserAuthorization(
      'user-operator',
      {
        status: 'enabled',
        organizationId: 'org-fcc',
        roleCodes: ['unit_manager'],
        areaIds: ['area-02'],
        expectedVersion: 1,
      },
      'user-admin',
    );
    await expect(service.authenticate(result.accessToken)).resolves.toMatchObject({
      roles: ['unit_manager'],
    });
    iam.updateUserAuthorization(
      'user-operator',
      {
        status: 'disabled',
        organizationId: 'org-fcc',
        roleCodes: ['unit_manager'],
        areaIds: ['area-02'],
        expectedVersion: 2,
      },
      'user-admin',
    );
    await expect(service.authenticate(result.accessToken)).rejects.toThrow(UnauthorizedException);
  });

  test('同一账号最多保留五个活动会话', async () => {
    const service = new AuthService(new IamService());
    const tokens: string[] = [];
    for (let index = 0; index < 6; index += 1) {
      tokens.push((await service.login('leader', 'ant.design')).accessToken);
    }
    await expect(service.authenticate(tokens[0])).rejects.toThrow(UnauthorizedException);
    await expect(service.authenticate(tokens[5])).resolves.toMatchObject({ userId: 'user-leader' });
  });

  test('会话后端故障时登录稳定返回服务不可用', async () => {
    const store = {
      backend: 'redis',
      create: jest.fn().mockRejectedValue(new Error('offline')),
      get: jest.fn(),
      delete: jest.fn(),
      ping: jest.fn(),
      close: jest.fn(),
    } as unknown as SessionStore;
    const service = new AuthService(new IamService(), undefined, new SessionStoreService(store));
    await expect(service.login('admin', 'ant.design')).rejects.toThrow(ServiceUnavailableException);
  });
});
