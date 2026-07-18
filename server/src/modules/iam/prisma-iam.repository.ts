import { Injectable } from '@nestjs/common';
import { Prisma, type UserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { requiresPasswordChange } from '../auth/password';
import {
  type IamRepository,
  IamRoleCodeConflictError,
  IamRoleNotFoundError,
  IamUserNotFoundError,
  IamUsernameConflictError,
  IamVersionConflictError,
} from './iam.repository';
import type { AreaAssignment, Organization, Permission, Role, UserAccount } from './iam.types';

@Injectable()
export class PrismaIamRepository implements IamRepository {
  constructor(private readonly prisma: PrismaService) {}

  async loadSnapshot() {
    const [organizationRecords, areaRecords, roleRecords, userRecords] = await Promise.all([
      this.prisma.organization.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.area.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.role.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.user.findMany({
        include: {
          roles: { include: { role: true } },
          areaAssignments: true,
        },
        orderBy: { username: 'asc' },
      }),
    ]);
    return {
      organizations: organizationRecords.map((item) => ({
        id: item.id,
        parentId: item.parentId ?? undefined,
        code: item.code,
        name: item.name,
        type: item.type as Organization['type'],
      })),
      areas: areaRecords.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        organizationId: item.organizationId,
      })) satisfies AreaAssignment[],
      roles: roleRecords.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        permissions: item.permissions as Permission[],
        dataScope: item.dataScope as Role['dataScope'],
      })),
      users: userRecords.map((item) => ({
        id: item.id,
        username: item.username,
        passwordHash: item.passwordHash,
        passwordChangeRequired: requiresPasswordChange(item.passwordHash),
        name: item.name,
        title: item.title,
        organizationId: item.organizationId,
        roleCodes: item.roles.map((assignment) => assignment.role.code),
        areaIds: item.areaAssignments.map((assignment) => assignment.areaId),
        status: item.status as UserAccount['status'],
        version: item.tokenVersion,
      })),
    };
  }

  async updateUserAuthorization(user: UserAccount, expectedVersion: number) {
    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.user.updateMany({
        where: { id: user.id, tokenVersion: expectedVersion },
        data: {
          organizationId: user.organizationId,
          status: user.status as UserStatus,
          tokenVersion: { increment: 1 },
        },
      });
      if (!result.count) {
        const current = await transaction.user.findUnique({
          where: { id: user.id },
          select: { tokenVersion: true },
        });
        if (!current) throw new IamUserNotFoundError();
        throw new IamVersionConflictError(expectedVersion, current.tokenVersion);
      }

      const assignedRoles = await transaction.role.findMany({
        where: { code: { in: user.roleCodes } },
        select: { id: true },
      });
      await transaction.userRole.deleteMany({ where: { userId: user.id } });
      if (assignedRoles.length) {
        await transaction.userRole.createMany({
          data: assignedRoles.map((role) => ({ userId: user.id, roleId: role.id })),
        });
      }
      await transaction.userAreaAssignment.deleteMany({ where: { userId: user.id } });
      if (user.areaIds.length) {
        await transaction.userAreaAssignment.createMany({
          data: user.areaIds.map((areaId) => ({ userId: user.id, areaId })),
        });
      }
      return expectedVersion + 1;
    });
  }

  async createUser(user: UserAccount) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const assignedRoles = await transaction.role.findMany({
          where: { code: { in: user.roleCodes } },
          select: { id: true },
        });
        await transaction.user.create({
          data: {
            id: user.id,
            username: user.username,
            passwordHash: user.passwordHash,
            name: user.name,
            title: user.title,
            organizationId: user.organizationId,
            status: user.status as UserStatus,
            tokenVersion: 1,
          },
        });
        if (assignedRoles.length) {
          await transaction.userRole.createMany({
            data: assignedRoles.map((role) => ({ userId: user.id, roleId: role.id })),
          });
        }
        if (user.areaIds.length) {
          await transaction.userAreaAssignment.createMany({
            data: user.areaIds.map((areaId) => ({ userId: user.id, areaId })),
          });
        }
        return 1;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new IamUsernameConflictError();
      }
      throw error;
    }
  }

  async updatePassword(userId: string, passwordHash: string) {
    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
        select: { tokenVersion: true },
      });
      return updated.tokenVersion;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new IamUserNotFoundError();
      }
      throw error;
    }
  }

  async createRole(role: Role) {
    try {
      await this.prisma.role.create({
        data: {
          id: role.id,
          code: role.code,
          name: role.name,
          permissions: role.permissions,
          dataScope: role.dataScope,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new IamRoleCodeConflictError();
      }
      throw error;
    }
  }

  async updateRole(role: Role) {
    try {
      await this.prisma.role.update({
        where: { id: role.id },
        data: {
          name: role.name,
          permissions: role.permissions,
          dataScope: role.dataScope,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new IamRoleNotFoundError();
      }
      throw error;
    }
  }
}
