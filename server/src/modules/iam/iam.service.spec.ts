/** @jest-environment node */

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { IamService } from './iam.service';

const operatorUpdate = {
  status: 'enabled' as const,
  organizationId: 'org-storage',
  roleCodes: ['operator'],
  areaIds: ['area-05'],
  expectedVersion: 1,
};

describe('IamService', () => {
  test('更新用户组织、角色和区域授权并递增版本', () => {
    const service = new IamService();
    const updated = service.updateUserAuthorization('user-operator', operatorUpdate, 'user-admin');

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

  test('拒绝过期版本、无效用户、角色和区域', () => {
    const service = new IamService();
    service.updateUserAuthorization('user-operator', operatorUpdate, 'user-admin');
    expect(() =>
      service.updateUserAuthorization('user-operator', operatorUpdate, 'user-admin'),
    ).toThrow(ConflictException);
    expect(() => service.updateUserAuthorization('missing', operatorUpdate, 'user-admin')).toThrow(
      NotFoundException,
    );
    expect(() =>
      new IamService().updateUserAuthorization(
        'user-operator',
        { ...operatorUpdate, roleCodes: ['missing_role'] },
        'user-admin',
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      new IamService().updateUserAuthorization(
        'user-operator',
        { ...operatorUpdate, areaIds: ['missing-area'] },
        'user-admin',
      ),
    ).toThrow(BadRequestException);
  });

  test('区域角色必须授权区域，全局角色自动清空区域', () => {
    const service = new IamService();
    expect(() =>
      service.updateUserAuthorization(
        'user-operator',
        { ...operatorUpdate, areaIds: [] },
        'user-admin',
      ),
    ).toThrow(BadRequestException);

    const updated = service.updateUserAuthorization(
      'user-operator',
      { ...operatorUpdate, roleCodes: ['enterprise_leader'], areaIds: ['area-05'] },
      'user-admin',
    );
    expect(updated.areaIds).toEqual([]);
  });

  test('禁止管理员停用自身或移除自身管理员角色', () => {
    const service = new IamService();
    expect(() =>
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
    ).toThrow(BadRequestException);
    expect(() =>
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
    ).toThrow(BadRequestException);
  });
});
