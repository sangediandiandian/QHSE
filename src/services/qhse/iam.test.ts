/** @jest-environment node */

import { request } from '@umijs/max';
import { getIamOverview, updateUserAuthorization } from './iam';

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
});
