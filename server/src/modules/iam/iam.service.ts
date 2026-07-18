import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import type { UpdateUserAuthorizationDto } from './iam.dto';
import { InMemoryIamRepository } from './in-memory-iam.repository';
import {
  type IamRepository,
  IamUserNotFoundError,
  IamVersionConflictError,
} from './iam.repository';
import { areas, organizations, roles, users } from './iam.seed';
import type {
  AreaAssignment,
  AuthPrincipal,
  Organization,
  Permission,
  Role,
  UserAccount,
} from './iam.types';

@Injectable()
export class IamService implements OnModuleInit {
  private organizations: Organization[] = [];
  private areas: AreaAssignment[] = [];
  private roles: Role[] = [];
  private accounts: UserAccount[] = [];
  private readonly versions = new Map<string, number>();

  constructor(private readonly repository: IamRepository = new InMemoryIamRepository()) {
    this.replaceSnapshot({
      organizations,
      areas,
      roles,
      users: users.map((user) => ({ ...user, version: 1 })),
    });
  }

  async onModuleInit() {
    this.replaceSnapshot(await this.repository.loadSnapshot());
  }

  listOrganizations() {
    return this.organizations.map((organization) => ({
      ...organization,
      areas: this.areas.filter((area) => area.organizationId === organization.id),
    }));
  }

  listRoles() {
    return this.roles.map((role) => ({ ...role, permissions: [...role.permissions] }));
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

  async updateUserAuthorization(id: string, input: UpdateUserAuthorizationDto, actorId: string) {
    const user = this.findUserById(id);
    if (!user) {
      throw new NotFoundException({ code: 'IAM_USER_NOT_FOUND', message: '用户不存在' });
    }
    const actualVersion = this.versions.get(id) ?? 1;
    if (input.expectedVersion !== actualVersion) {
      this.versionConflict(input.expectedVersion, actualVersion);
    }
    if (!this.organizations.some((item) => item.id === input.organizationId)) {
      throw new BadRequestException({
        code: 'IAM_ORGANIZATION_INVALID',
        message: '所属组织不存在',
      });
    }
    const assignedRoles = input.roleCodes.map((code) =>
      this.roles.find((role) => role.code === code),
    );
    if (assignedRoles.some((role) => !role)) {
      throw new BadRequestException({ code: 'IAM_ROLE_INVALID', message: '包含无效角色' });
    }
    if (input.areaIds.some((areaId) => !this.areas.some((area) => area.id === areaId))) {
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

    const updated: UserAccount = {
      ...user,
      status: input.status,
      organizationId: input.organizationId,
      roleCodes: [...input.roleCodes],
      areaIds: isAllScope ? [] : [...input.areaIds],
    };
    try {
      const version = await this.repository.updateUserAuthorization(updated, input.expectedVersion);
      Object.assign(user, updated);
      this.versions.set(id, version);
      return this.toManagedUser(user);
    } catch (error) {
      if (error instanceof IamUserNotFoundError) {
        throw new NotFoundException({ code: 'IAM_USER_NOT_FOUND', message: '用户不存在' });
      }
      if (error instanceof IamVersionConflictError) {
        this.versionConflict(error.expectedVersion, error.actualVersion);
      }
      throw error;
    }
  }

  createPrincipal(user: UserAccount): AuthPrincipal {
    const assignedRoles = this.roles.filter((role) => user.roleCodes.includes(role.code));
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
      organization: this.organizations.find((item) => item.id === user.organizationId),
      roles: this.roles
        .filter((role) => user.roleCodes.includes(role.code))
        .map((role) => ({ ...role, permissions: [...role.permissions] })),
    };
  }

  private replaceSnapshot(snapshot: Awaited<ReturnType<IamRepository['loadSnapshot']>>) {
    this.organizations = snapshot.organizations.map((item) => ({ ...item }));
    this.areas = snapshot.areas.map((item) => ({ ...item }));
    this.roles = snapshot.roles.map((item) => ({
      ...item,
      permissions: [...item.permissions],
    }));
    this.accounts = snapshot.users.map((user) => ({
      id: user.id,
      username: user.username,
      name: user.name,
      title: user.title,
      organizationId: user.organizationId,
      status: user.status,
      roleCodes: [...user.roleCodes],
      areaIds: [...user.areaIds],
    }));
    this.versions.clear();
    snapshot.users.forEach((user) => this.versions.set(user.id, user.version));
  }

  private versionConflict(expectedVersion: number, actualVersion: number): never {
    throw new ConflictException({
      code: 'VERSION_CONFLICT',
      message: '用户授权已被其他管理员更新，请刷新后重试',
      details: { expectedVersion, actualVersion },
    });
  }
}
