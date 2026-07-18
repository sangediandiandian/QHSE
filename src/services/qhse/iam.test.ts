/** @jest-environment node */

import { request } from '@umijs/max';
import {
  createIamUser,
  createIamRole,
  getIamOverview,
  resetIamUserPassword,
  updateIamRole,
  updateUserAuthorization,
} from './iam';

jest.mock('@umijs/max', () => ({ request: jest.fn() }));

const requestMock = request as jest.Mock;

describe('iam service', () => {
  test('并行读取组织、角色和用户', async () => {
    requestMock
      .mockResolvedValueOnce({ data: [{ id: 'org-1' }] })
      .mockResolvedValueOnce({ data: [{ id: 'role-1' }] })
      .mockResolvedValueOnce({ data: [{ id: 'user-1' }] });

    await expect(getIamOverview()).resolves.toEqual({
      organizations: [{ id: 'org-1' }],
      roles: [{ id: 'role-1' }],
      users: [{ id: 'user-1' }],
    });
  });

  test('更新授权携带当前版本', async () => {
    const user = { id: 'user-1', version: 3 };
    const input = {
      status: 'enabled' as const,
      organizationId: 'org-1',
      roleCodes: ['operator'],
      areaIds: ['area-1'],
    };
    requestMock.mockResolvedValue({ data: { ...user, ...input, version: 4 } });

    await updateUserAuthorization(user as never, input);
    expect(requestMock).toHaveBeenCalledWith('/api/v1/iam/users/user-1/authorization', {
      method: 'PUT',
      data: { ...input, expectedVersion: 3 },
    });
  });

  test('创建用户只提交初始密码和授权', async () => {
    const input = {
      username: 'new_operator',
      name: '新操作员',
      title: '岗位操作员',
      initialPassword: 'TempPass-2026',
      organizationId: 'org-fcc',
      roleCodes: ['operator'],
      areaIds: ['area-02'],
    };
    requestMock.mockResolvedValue({ data: { id: 'user-created', ...input } });

    await createIamUser(input);
    expect(requestMock).toHaveBeenCalledWith('/api/v1/iam/users', {
      method: 'POST',
      data: input,
    });
  });

  test('管理员重置密码只提交临时密码', async () => {
    requestMock.mockResolvedValue({
      data: { passwordReset: true, passwordChangeRequired: true },
    });

    await resetIamUserPassword('user-1', 'ResetPass-2026');
    expect(requestMock).toHaveBeenCalledWith('/api/v1/auth/users/user-1/password-reset', {
      method: 'PUT',
      data: { temporaryPassword: 'ResetPass-2026' },
    });
  });

  test('创建和更新自定义角色提交权限矩阵', async () => {
    const input = {
      code: 'safety_observer',
      name: '安全观察员',
      permissions: ['risk:read', 'hazard:read'],
      dataScope: 'assigned_areas' as const,
    };
    requestMock.mockResolvedValue({ data: { id: 'role-custom-1', ...input } });

    await createIamRole(input);
    expect(requestMock).toHaveBeenCalledWith('/api/v1/iam/roles', {
      method: 'POST',
      data: input,
    });
    const update = {
      name: input.name,
      permissions: input.permissions,
      dataScope: input.dataScope,
    };
    await updateIamRole('role-custom-1', update);
    expect(requestMock).toHaveBeenCalledWith('/api/v1/iam/roles/role-custom-1', {
      method: 'PUT',
      data: update,
    });
  });
});
