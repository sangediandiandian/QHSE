/** @jest-environment node */

import type { PrismaService } from '../../database/prisma.service';
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

    const reloaded = new IamService(repository);
    await reloaded.onModuleInit();
    expect(reloaded.listUsers().find((user) => user.id === 'user-operator')).toMatchObject({
      organizationId: 'org-storage',
      areaIds: ['area-05'],
      version: 2,
    });
  });

  test('Prisma 仓储加载关系并在单事务替换角色和区域', async () => {
    const transaction = {
      user: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'user-2' }),
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
      },
      $transaction: jest.fn((callback) => callback(transaction)),
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
