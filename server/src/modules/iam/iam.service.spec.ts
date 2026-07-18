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
  test('用户授权申请必须异人审批并在通过后应用授权', async () => {
    const service = new IamService(undefined, () => 'request-id');
    const requester = service.createPrincipal(service.findUserById('user-admin')!);
    const approver = { ...requester, userId: 'user-approver', name: '审批管理员' };
    const request = await service.submitAuthorizationRequest(
      'user-operator',
      { ...operatorUpdate, reason: '岗位调整至储运部' },
      requester,
    );
    expect(request).toMatchObject({
      id: 'iam-request-request-id',
      status: 'pending',
      expectedUserVersion: 1,
      targetUser: { id: 'user-operator' },
    });
    await expect(
      service.reviewAuthorizationRequest(
        request.id,
        { decision: 'approve', opinion: '同意', expectedVersion: 1 },
        requester,
      ),
    ).rejects.toThrow(BadRequestException);

    const approved = await service.reviewAuthorizationRequest(
      request.id,
      { decision: 'approve', opinion: '同意', expectedVersion: 1 },
      approver,
    );
    expect(approved).toMatchObject({
      status: 'approved',
      reviewedById: 'user-approver',
      version: 2,
      targetUser: { organizationId: 'org-storage', areaIds: ['area-05'], version: 2 },
    });
  });

  test('审批期间用户授权变化时拒绝覆盖且申请保持待审批', async () => {
    const service = new IamService(undefined, () => 'request-stale');
    const requester = service.createPrincipal(service.findUserById('user-admin')!);
    const approver = { ...requester, userId: 'user-approver', name: '审批管理员' };
    const request = await service.submitAuthorizationRequest(
      'user-operator',
      { ...operatorUpdate, reason: '岗位调整' },
      requester,
    );
    await service.updateUserAuthorization(
      'user-operator',
      {
        ...operatorUpdate,
        organizationId: 'org-fcc',
        areaIds: ['area-02'],
      },
      'user-approver',
    );

    await expect(
      service.reviewAuthorizationRequest(
        request.id,
        { decision: 'approve', opinion: '', expectedVersion: 1 },
        approver,
      ),
    ).rejects.toThrow(ConflictException);
    await expect(service.listAuthorizationRequests()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: request.id, status: 'pending' })]),
    );
  });

  test('同一用户只允许一条待审批申请且驳回必须填写意见', async () => {
    const service = new IamService(undefined, () => 'request-reject');
    const requester = service.createPrincipal(service.findUserById('user-admin')!);
    const approver = { ...requester, userId: 'user-approver', name: '审批管理员' };
    const request = await service.submitAuthorizationRequest(
      'user-operator',
      { ...operatorUpdate, reason: '岗位调整' },
      requester,
    );

    await expect(
      service.submitAuthorizationRequest(
        'user-operator',
        { ...operatorUpdate, reason: '重复申请' },
        requester,
      ),
    ).rejects.toThrow(ConflictException);
    await expect(
      service.reviewAuthorizationRequest(
        request.id,
        { decision: 'reject', opinion: '  ', expectedVersion: 1 },
        approver,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.reviewAuthorizationRequest(
        request.id,
        { decision: 'reject', opinion: '职责依据不足', expectedVersion: 1 },
        approver,
      ),
    ).resolves.toMatchObject({
      status: 'rejected',
      opinion: '职责依据不足',
      version: 2,
    });
  });

  test('创建并维护自定义角色，权限变化立即作用于已授权用户', async () => {
    const service = new IamService(undefined, () => 'role-id');
    const created = await service.createRole({
      code: 'safety_observer',
      name: '安全观察员',
      permissions: ['risk:read'],
      dataScope: 'assigned_areas',
    });
    expect(created).toMatchObject({
      id: 'role-custom-role-id',
      code: 'safety_observer',
      editable: true,
      assignedUserCount: 0,
    });
    await service.updateUserAuthorization(
      'user-operator',
      {
        ...operatorUpdate,
        organizationId: 'org-fcc',
        roleCodes: ['safety_observer'],
        areaIds: ['area-02'],
      },
      'user-admin',
    );
    expect(service.createPrincipal(service.findUserById('user-operator')!).permissions).toEqual([
      'risk:read',
    ]);

    const updated = await service.updateRole(created.id, {
      name: '安全巡查员',
      permissions: ['risk:read', 'hazard:read'],
      dataScope: 'assigned_areas',
    });
    expect(updated).toMatchObject({ name: '安全巡查员', assignedUserCount: 1 });
    expect(service.createPrincipal(service.findUserById('user-operator')!).permissions).toEqual([
      'risk:read',
      'hazard:read',
    ]);
    await expect(
      service.updateRole(created.id, {
        name: '安全巡查员',
        permissions: ['risk:read'],
        dataScope: 'all',
      }),
    ).rejects.toThrow(ConflictException);
  });

  test('拒绝重复角色编码和修改内置角色', async () => {
    const service = new IamService();
    await expect(
      service.createRole({
        code: 'operator',
        name: '重复角色',
        permissions: ['risk:read'],
        dataScope: 'assigned_areas',
      }),
    ).rejects.toThrow(ConflictException);
    await expect(
      service.updateRole('role-admin', {
        name: '管理员',
        permissions: ['iam:read'],
        dataScope: 'all',
      }),
    ).rejects.toThrow(BadRequestException);
  });

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
