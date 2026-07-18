/** @jest-environment node */

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { verifyPassword } from '../auth/password';
import { IamService } from './iam.service';

const operatorUpdate = {
  status: 'enabled' as const,
  organizationId: 'org-storage',
  roleCodes: ['operator'],
  areaIds: ['area-05'],
  expectedVersion: 1,
};

describe('IamService', () => {
  test('创建用户时哈希初始密码且不向列表泄露摘要', async () => {
    const service = new IamService(undefined, () => 'user-created');
    const created = await service.createUser({
      username: 'new.operator',
      name: ' 新操作员 ',
      title: ' 岗位操作员 ',
      initialPassword: 'TempPass-2026',
      organizationId: 'org-fcc',
      roleCodes: ['operator'],
      areaIds: ['area-02'],
    });

    expect(created).toMatchObject({
      id: 'user-created',
      username: 'new.operator',
      name: '新操作员',
      title: '岗位操作员',
      version: 1,
    });
    expect(created).not.toHaveProperty('passwordHash');
    expect(
      verifyPassword('TempPass-2026', service.findUserByUsername('new.operator')!.passwordHash),
    ).toBe(true);
    await expect(
      service.createUser({
        username: 'new.operator',
        name: '重复账号',
        title: '操作员',
        initialPassword: 'TempPass-2026',
        organizationId: 'org-fcc',
        roleCodes: ['operator'],
        areaIds: ['area-02'],
      }),
    ).rejects.toThrow(ConflictException);
  });

  test('更新用户组织、角色和区域授权并递增版本', async () => {
    const service = new IamService();
    const updated = await service.updateUserAuthorization(
      'user-operator',
      operatorUpdate,
      'user-admin',
    );

    expect(updated).toMatchObject({
      organizationId: 'org-storage',
      roleCodes: ['operator'],
      areaIds: ['area-05'],
      version: 2,
    });
    expect(service.createPrincipal(service.findUserById('user-operator')!)).toMatchObject({
      dataScope: 'assigned_areas',
      areaIds: ['area-05'],
    });
  });

  test('拒绝过期版本、无效用户、角色和区域', async () => {
    const service = new IamService();
    await service.updateUserAuthorization('user-operator', operatorUpdate, 'user-admin');
    await expect(
      service.updateUserAuthorization('user-operator', operatorUpdate, 'user-admin'),
    ).rejects.toThrow(ConflictException);
    await expect(
      service.updateUserAuthorization('missing', operatorUpdate, 'user-admin'),
    ).rejects.toThrow(NotFoundException);
    await expect(
      new IamService().updateUserAuthorization(
        'user-operator',
        { ...operatorUpdate, roleCodes: ['missing_role'] },
        'user-admin',
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      new IamService().updateUserAuthorization(
        'user-operator',
        { ...operatorUpdate, areaIds: ['missing-area'] },
        'user-admin',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  test('区域角色必须授权区域，全局角色自动清空区域', async () => {
    const service = new IamService();
    await expect(
      service.updateUserAuthorization(
        'user-operator',
        { ...operatorUpdate, areaIds: [] },
        'user-admin',
      ),
    ).rejects.toThrow(BadRequestException);

    const updated = await service.updateUserAuthorization(
      'user-operator',
      { ...operatorUpdate, roleCodes: ['enterprise_leader'], areaIds: ['area-05'] },
      'user-admin',
    );
    expect(updated.areaIds).toEqual([]);
  });

  test('禁止管理员停用自身或移除自身管理员角色', async () => {
    const service = new IamService();
    await expect(
      service.updateUserAuthorization(
        'user-admin',
        {
          status: 'disabled',
          organizationId: 'org-qhse',
          roleCodes: ['system_admin'],
          areaIds: [],
          expectedVersion: 1,
        },
        'user-admin',
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.updateUserAuthorization(
        'user-admin',
        {
          status: 'enabled',
          organizationId: 'org-qhse',
          roleCodes: ['qhse_manager'],
          areaIds: [],
          expectedVersion: 1,
        },
        'user-admin',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
