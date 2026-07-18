import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { areas, organizations, roles, users } from './iam.seed';
import type { UpdateUserAuthorizationDto } from './iam.dto';
import type { AuthPrincipal, Permission, UserAccount } from './iam.types';

@Injectable()
export class IamService {
  private readonly accounts = users.map((user) => ({
    ...user,
    roleCodes: [...user.roleCodes],
    areaIds: [...user.areaIds],
  }));
  private readonly versions = new Map(this.accounts.map((user) => [user.id, 1]));

  listOrganizations() {
    return organizations.map((organization) => ({
      ...organization,
      areas: areas.filter((area) => area.organizationId === organization.id),
    }));
  }

  listRoles() {
    return roles.map((role) => ({ ...role, permissions: [...role.permissions] }));
  }

  listUsers() {
    return this.accounts.map((user) => this.toManagedUser(user));
  }

  findUserByUsername(username: string) {
    return this.accounts.find((user) => user.username === username);
  }

  findUserById(id: string) {
    return this.accounts.find((user) => user.id === id);
  }

  updateUserAuthorization(id: string, input: UpdateUserAuthorizationDto, actorId: string) {
    const user = this.findUserById(id);
    if (!user) {
      throw new NotFoundException({ code: 'IAM_USER_NOT_FOUND', message: '用户不存在' });
    }
    const actualVersion = this.versions.get(id) ?? 1;
    if (input.expectedVersion !== actualVersion) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: '用户授权已被其他管理员更新，请刷新后重试',
        details: { expectedVersion: input.expectedVersion, actualVersion },
      });
    }
    if (!organizations.some((item) => item.id === input.organizationId)) {
      throw new BadRequestException({
        code: 'IAM_ORGANIZATION_INVALID',
        message: '所属组织不存在',
      });
    }
    const assignedRoles = input.roleCodes.map((code) => roles.find((role) => role.code === code));
    if (assignedRoles.some((role) => !role)) {
      throw new BadRequestException({ code: 'IAM_ROLE_INVALID', message: '包含无效角色' });
    }
    if (input.areaIds.some((areaId) => !areas.some((area) => area.id === areaId))) {
      throw new BadRequestException({ code: 'IAM_AREA_INVALID', message: '包含无效区域' });
    }
    const isAllScope = assignedRoles.some((role) => role?.dataScope === 'all');
    if (!isAllScope && input.areaIds.length === 0) {
      throw new BadRequestException({
        code: 'IAM_AREA_REQUIRED',
        message: '区域数据权限角色至少需要分配一个区域',
      });
    }
    if (
      actorId === id &&
      (input.status === 'disabled' || !input.roleCodes.includes('system_admin'))
    ) {
      throw new BadRequestException({
        code: 'IAM_SELF_LOCKOUT',
        message: '不能停用当前账号或移除自己的系统管理员角色',
      });
    }

    user.status = input.status;
    user.organizationId = input.organizationId;
    user.roleCodes = [...input.roleCodes];
    user.areaIds = isAllScope ? [] : [...input.areaIds];
    this.versions.set(id, actualVersion + 1);
    return this.toManagedUser(user);
  }

  createPrincipal(user: UserAccount): AuthPrincipal {
    const assignedRoles = roles.filter((role) => user.roleCodes.includes(role.code));
    const granted = new Set<Permission>(assignedRoles.flatMap((role) => role.permissions));
    return {
      userId: user.id,
      username: user.username,
      name: user.name,
      organizationId: user.organizationId,
      roles: assignedRoles.map((role) => role.code),
      permissions: [...granted],
      dataScope: assignedRoles.some((role) => role.dataScope === 'all') ? 'all' : 'assigned_areas',
      areaIds: [...user.areaIds],
    };
  }

  private toManagedUser(user: UserAccount) {
    return {
      ...user,
      roleCodes: [...user.roleCodes],
      areaIds: [...user.areaIds],
      version: this.versions.get(user.id) ?? 1,
      organization: organizations.find((item) => item.id === user.organizationId),
      roles: roles
        .filter((role) => user.roleCodes.includes(role.code))
        .map((role) => ({ ...role, permissions: [...role.permissions] })),
    };
  }
}
