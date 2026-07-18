/** @jest-environment node */

import type { PrismaService } from '../../database/prisma.service';
import type { IamAuthorizationRequest, Role } from './iam.types';
import { InMemoryIamRepository } from './in-memory-iam.repository';
import { IamVersionConflictError } from './iam.repository';
import { IamService } from './iam.service';
import { PrismaIamRepository } from './prisma-iam.repository';

describe('IAM repositories', () => {
  test('内存仓储可被新服务实例重新加载', async () => {
    const repository = new InMemoryIamRepository();
    const first = new IamService(repository);
    await first.onModuleInit();
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
    await first.updatePassword('user-operator', 'ResetPass-2026', true);
    await first.createRole({
      code: 'safety_observer',
      name: '安全观察员',
      permissions: ['risk:read'],
      dataScope: 'assigned_areas',
    });
    const actor = first.createPrincipal(first.findUserById('user-admin')!);
    await first.submitAuthorizationRequest(
      'user-operator',
      {
        status: 'enabled',
        organizationId: 'org-storage',
        roleCodes: ['operator'],
        areaIds: ['area-05'],
        expectedVersion: 3,
        reason: '验证申请重载',
      },
      actor,
    );

    const reloaded = new IamService(repository);
    await reloaded.onModuleInit();
    expect(reloaded.listUsers().find((user) => user.id === 'user-operator')).toMatchObject({
      organizationId: 'org-storage',
      areaIds: ['area-05'],
      passwordChangeRequired: true,
      version: 3,
    });
    expect(reloaded.listRoles()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'safety_observer', editable: true }),
      ]),
    );
    await expect(reloaded.listAuthorizationRequests()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ status: 'pending' })]),
    );
  });

  test('Prisma 仓储加载关系并在单事务替换角色和区域', async () => {
    const transaction = {
      user: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'user-2' }),
      },
      iamAuthorizationRequest: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'request-1' }),
      },
      role: {
        findMany: jest.fn().mockResolvedValue([{ id: 'role-unit' }]),
      },
      userRole: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      userAreaAssignment: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      organization: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'org-1', parentId: null, code: 'ORG', name: '组织', type: '企业' },
          ]),
      },
      area: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'area-1', code: 'AREA', name: '区域', organizationId: 'org-1' },
          ]),
      },
      role: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'role-unit',
            code: 'unit_manager',
            name: '装置负责人',
            permissions: ['risk:read'],
            dataScope: 'assigned_areas',
          },
        ]),
        create: jest.fn().mockResolvedValue({ id: 'role-custom' }),
        update: jest.fn().mockResolvedValue({ id: 'role-custom' }),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'user-1',
            username: 'unit',
            passwordHash: 'scrypt$salt$hash',
            name: '装置负责人',
            title: '负责人',
            organizationId: 'org-1',
            status: 'enabled',
            tokenVersion: 3,
            roles: [{ role: { code: 'unit_manager' } }],
            areaAssignments: [{ areaId: 'area-1' }],
          },
        ]),
        update: jest.fn().mockResolvedValue({ tokenVersion: 5 }),
      },
      $transaction: jest.fn((callback) => callback(transaction)),
      iamAuthorizationRequest: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'request-1' }),
      },
    };
    const repository = new PrismaIamRepository(prisma as unknown as PrismaService);

    await expect(repository.loadSnapshot()).resolves.toMatchObject({
      users: [{ id: 'user-1', roleCodes: ['unit_manager'], areaIds: ['area-1'], version: 3 }],
    });
    await expect(
      repository.updateUserAuthorization(
        {
          id: 'user-1',
          username: 'unit',
          passwordHash: 'scrypt$salt$hash',
          passwordChangeRequired: false,
          name: '装置负责人',
          title: '负责人',
          organizationId: 'org-1',
          roleCodes: ['unit_manager'],
          areaIds: ['area-1'],
          status: 'enabled',
        },
        3,
      ),
    ).resolves.toBe(4);
    expect(transaction.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', tokenVersion: 3 },
      data: {
        organizationId: 'org-1',
        status: 'enabled',
        tokenVersion: { increment: 1 },
      },
    });
    expect(transaction.userRole.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', roleId: 'role-unit' }],
    });
    expect(transaction.userAreaAssignment.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', areaId: 'area-1' }],
    });
    await expect(
      repository.createUser({
        id: 'user-2',
        username: 'new-user',
        passwordHash: 'scrypt$new-salt$new-hash',
        passwordChangeRequired: false,
        name: '新用户',
        title: '操作员',
        organizationId: 'org-1',
        roleCodes: ['unit_manager'],
        areaIds: ['area-1'],
        status: 'enabled',
      }),
    ).resolves.toBe(1);
    expect(transaction.user.create).toHaveBeenCalledWith({
      data: {
        id: 'user-2',
        username: 'new-user',
        passwordHash: 'scrypt$new-salt$new-hash',
        name: '新用户',
        title: '操作员',
        organizationId: 'org-1',
        status: 'enabled',
        tokenVersion: 1,
      },
    });
    await expect(
      repository.updatePassword('user-1', 'scrypt-change$new-salt$new-hash'),
    ).resolves.toBe(5);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        passwordHash: 'scrypt-change$new-salt$new-hash',
        tokenVersion: { increment: 1 },
      },
      select: { tokenVersion: true },
    });
    const customRole: Role = {
      id: 'role-custom-1',
      code: 'safety_observer',
      name: '安全观察员',
      permissions: ['risk:read'],
      dataScope: 'assigned_areas',
    };
    await repository.createRole(customRole);
    expect(prisma.role.create).toHaveBeenCalledWith({ data: customRole });
    await repository.updateRole({ ...customRole, name: '安全巡查员' });
    expect(prisma.role.update).toHaveBeenCalledWith({
      where: { id: 'role-custom-1' },
      data: {
        name: '安全巡查员',
        permissions: ['risk:read'],
        dataScope: 'assigned_areas',
      },
    });
    const timestamp = '2026-07-18T12:00:00.000Z';
    const authorizationRequest: IamAuthorizationRequest = {
      id: 'request-1',
      targetUserId: 'user-1',
      requestedById: 'user-admin',
      requestedByName: '管理员',
      proposedAuthorization: {
        status: 'enabled',
        organizationId: 'org-1',
        roleCodes: ['unit_manager'],
        areaIds: ['area-1'],
      },
      expectedUserVersion: 3,
      reason: '岗位调整',
      status: 'pending',
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await repository.createAuthorizationRequest(authorizationRequest);
    expect(prisma.iamAuthorizationRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'request-1',
        targetUserId: 'user-1',
        status: 'pending',
      }),
    });
    const reviewed = {
      ...authorizationRequest,
      status: 'approved' as const,
      reviewedById: 'user-approver',
      reviewedByName: '审批管理员',
      reviewedAt: timestamp,
      version: 1,
    };
    await expect(
      repository.reviewAuthorizationRequest(reviewed, 1, {
        id: 'user-1',
        username: 'unit',
        passwordHash: 'scrypt$salt$hash',
        passwordChangeRequired: false,
        name: '装置负责人',
        title: '负责人',
        organizationId: 'org-1',
        roleCodes: ['unit_manager'],
        areaIds: ['area-1'],
        status: 'enabled',
      }),
    ).resolves.toEqual({ requestVersion: 2, userVersion: 4 });
    expect(transaction.iamAuthorizationRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'request-1', status: 'pending', version: 1 },
      data: expect.objectContaining({
        status: 'approved',
        reviewedById: 'user-approver',
        version: { increment: 1 },
      }),
    });
  });

  test('Prisma 仓储把条件更新失败映射为版本冲突', async () => {
    const transaction = {
      user: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({ tokenVersion: 5 }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(transaction)),
    };
    const repository = new PrismaIamRepository(prisma as unknown as PrismaService);

    await expect(
      repository.updateUserAuthorization(
        {
          id: 'user-1',
          username: 'unit',
          passwordHash: 'scrypt$salt$hash',
          passwordChangeRequired: false,
          name: '装置负责人',
          title: '负责人',
          organizationId: 'org-1',
          roleCodes: ['unit_manager'],
          areaIds: ['area-1'],
          status: 'enabled',
        },
        4,
      ),
    ).rejects.toEqual(new IamVersionConflictError(4, 5));
  });
});
