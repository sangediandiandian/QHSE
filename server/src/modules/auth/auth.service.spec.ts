/** @jest-environment node */

import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { IamService } from '../iam/iam.service';
import { AuthService } from './auth.service';
import { SessionStoreService } from '../../infrastructure/session/session-store.service';
import type { SessionStore } from '../../infrastructure/session/session-store';

describe('AuthService', () => {
  test('关闭本地登录后拒绝账号密码认证', async () => {
    const original = process.env.QHSE_LOCAL_LOGIN_ENABLED;
    process.env.QHSE_LOCAL_LOGIN_ENABLED = 'false';
    try {
      await expect(new AuthService(new IamService()).login('admin', 'ant.design')).rejects.toThrow(
        UnauthorizedException,
      );
    } finally {
      if (original === undefined) delete process.env.QHSE_LOCAL_LOGIN_ENABLED;
      else process.env.QHSE_LOCAL_LOGIN_ENABLED = original;
    }
  });

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

  test('新建账号只能使用自己的初始密码登录', async () => {
    const iam = new IamService(undefined, () => 'user-created');
    await iam.createUser({
      username: 'new_operator',
      name: '新操作员',
      title: '岗位操作员',
      initialPassword: 'TempPass-2026',
      organizationId: 'org-fcc',
      roleCodes: ['operator'],
      areaIds: ['area-02'],
    });
    const service = new AuthService(iam);

    await expect(service.login('new_operator', 'TempPass-2026')).resolves.toMatchObject({
      user: { userId: 'user-created', roles: ['operator'] },
      passwordChangeRequired: true,
    });
    await expect(service.login('new_operator', 'ant.design')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  test('首次登录修改密码后撤销全部旧会话并要求重新登录', async () => {
    const iam = new IamService(undefined, () => 'user-created');
    await iam.createUser({
      username: 'new_operator',
      name: '新操作员',
      title: '岗位操作员',
      initialPassword: 'TempPass-2026',
      organizationId: 'org-fcc',
      roleCodes: ['operator'],
      areaIds: ['area-02'],
    });
    const service = new AuthService(iam);
    const first = await service.login('new_operator', 'TempPass-2026');
    const second = await service.login('new_operator', 'TempPass-2026');

    await expect(
      service.changePassword('user-created', 'TempPass-2026', 'PrivatePass-2026'),
    ).resolves.toEqual({ passwordChanged: true, reauthenticationRequired: true });
    await expect(service.authenticate(first.accessToken)).rejects.toThrow(UnauthorizedException);
    await expect(service.authenticate(second.accessToken)).rejects.toThrow(UnauthorizedException);
    await expect(service.login('new_operator', 'TempPass-2026')).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.login('new_operator', 'PrivatePass-2026')).resolves.toMatchObject({
      passwordChangeRequired: false,
    });
  });

  test('管理员重置密码后撤销全部会话并恢复强制改密', async () => {
    const iam = new IamService();
    const service = new AuthService(iam);
    const session = await service.login('operator', 'ant.design');

    await expect(service.resetPassword('user-operator', 'ResetPass-2026')).resolves.toMatchObject({
      passwordReset: true,
      passwordChangeRequired: true,
      user: { id: 'user-operator', passwordChangeRequired: true },
    });
    await expect(service.authenticate(session.accessToken)).rejects.toThrow(UnauthorizedException);
    await expect(service.login('operator', 'ant.design')).rejects.toThrow(UnauthorizedException);
    await expect(service.login('operator', 'ResetPass-2026')).resolves.toMatchObject({
      passwordChangeRequired: true,
    });
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
    await iam.updateUserAuthorization(
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
    await iam.updateUserAuthorization(
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
