import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { hashPassword, requiresPasswordChange } from '../auth/password';
import { IamChangeBusService } from './iam-change-bus.service';
import type {
  CreateRoleDto,
  CreateUserDto,
  ReviewAuthorizationRequestDto,
  SubmitAuthorizationRequestDto,
  UpdateRoleDto,
  UpdateUserAuthorizationDto,
} from './iam.dto';
import { InMemoryIamRepository } from './in-memory-iam.repository';
import {
  type IamRepository,
  IamAuthorizationRequestConflictError,
  IamAuthorizationRequestNotFoundError,
  IamAuthorizationRequestVersionConflictError,
  IamRoleCodeConflictError,
  IamRoleNotFoundError,
  IamUserNotFoundError,
  IamUsernameConflictError,
  IamVersionConflictError,
} from './iam.repository';
import { areas, organizations, roles, users } from './iam.seed';
import type {
  AreaAssignment,
  AuthPrincipal,
  IamAuthorizationRequest,
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
  private readonly now: () => Date;
  private refreshChain = Promise.resolve();

  constructor(
    private readonly repository: IamRepository = new InMemoryIamRepository(),
    private readonly createId: () => string = randomUUID,
    now: () => Date = () => new Date(),
    private readonly changes: IamChangeBusService = new IamChangeBusService(),
  ) {
    this.now = now;
    this.replaceSnapshot({
      organizations,
      areas,
      roles,
      users: users.map((user) => ({ ...user, version: 1 })),
    });
  }

  async onModuleInit() {
    await this.changes.start(() => this.refreshSnapshot());
    await this.refreshSnapshot();
  }

  listOrganizations() {
    return this.organizations.map((organization) => ({
      ...organization,
      areas: this.areas.filter((area) => area.organizationId === organization.id),
    }));
  }

  listRoles() {
    return this.roles.map((role) => this.toManagedRole(role));
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

  async createUser(input: CreateUserDto) {
    const username = input.username.trim().toLowerCase();
    if (this.accounts.some((user) => user.username.toLowerCase() === username)) {
      throw new ConflictException({ code: 'IAM_USERNAME_EXISTS', message: '登录账号已存在' });
    }
    const areaIds = this.validateAssignment(input.organizationId, input.roleCodes, input.areaIds);
    const user: UserAccount = {
      id: this.createId(),
      username,
      passwordHash: hashPassword(input.initialPassword, true),
      passwordChangeRequired: true,
      name: input.name.trim(),
      title: input.title.trim(),
      organizationId: input.organizationId,
      roleCodes: [...input.roleCodes],
      areaIds,
      status: 'enabled',
    };
    try {
      const version = await this.repository.createUser(user);
      this.accounts.push(user);
      this.versions.set(user.id, version);
      await this.changes.publish('user.created', user.id);
      return this.toManagedUser(user);
    } catch (error) {
      if (error instanceof IamUsernameConflictError) {
        throw new ConflictException({ code: 'IAM_USERNAME_EXISTS', message: '登录账号已存在' });
      }
      throw error;
    }
  }

  async createRole(input: CreateRoleDto) {
    const code = input.code.trim().toLowerCase();
    if (this.roles.some((role) => role.code.toLowerCase() === code)) {
      throw new ConflictException({ code: 'IAM_ROLE_CODE_EXISTS', message: '角色编码已存在' });
    }
    const role: Role = {
      id: `role-custom-${this.createId()}`,
      code,
      name: input.name.trim(),
      permissions: [...input.permissions],
      dataScope: input.dataScope,
    };
    try {
      await this.repository.createRole(role);
      this.roles.push(role);
      await this.changes.publish('role.created', role.id);
      return this.toManagedRole(role);
    } catch (error) {
      if (error instanceof IamRoleCodeConflictError) {
        throw new ConflictException({ code: 'IAM_ROLE_CODE_EXISTS', message: '角色编码已存在' });
      }
      throw error;
    }
  }

  async updateRole(id: string, input: UpdateRoleDto) {
    const role = this.roles.find((item) => item.id === id);
    if (!role) {
      throw new NotFoundException({ code: 'IAM_ROLE_NOT_FOUND', message: '角色不存在' });
    }
    if (!this.isCustomRole(role)) {
      throw new BadRequestException({
        code: 'IAM_SYSTEM_ROLE_READONLY',
        message: '内置角色不可修改',
      });
    }
    if (
      role.dataScope !== input.dataScope &&
      this.accounts.some((user) => user.roleCodes.includes(role.code))
    ) {
      throw new ConflictException({
        code: 'IAM_ROLE_SCOPE_IN_USE',
        message: '角色已分配给用户，调整数据范围前请先移除相关用户授权',
      });
    }
    const updated: Role = {
      ...role,
      name: input.name.trim(),
      permissions: [...input.permissions],
      dataScope: input.dataScope,
    };
    try {
      await this.repository.updateRole(updated);
      Object.assign(role, updated);
      await this.changes.publish('role.updated', role.id);
      return this.toManagedRole(role);
    } catch (error) {
      if (error instanceof IamRoleNotFoundError) {
        throw new NotFoundException({ code: 'IAM_ROLE_NOT_FOUND', message: '角色不存在' });
      }
      throw error;
    }
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
    const areaIds = this.validateAssignment(input.organizationId, input.roleCodes, input.areaIds);
    this.ensureNoSelfLockout(id, input, actorId);

    const updated: UserAccount = {
      ...user,
      status: input.status,
      organizationId: input.organizationId,
      roleCodes: [...input.roleCodes],
      areaIds,
    };
    try {
      const version = await this.repository.updateUserAuthorization(updated, input.expectedVersion);
      Object.assign(user, updated);
      this.versions.set(id, version);
      await this.changes.publish('user.authorization.updated', id);
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

  async listAuthorizationRequests() {
    const requests = await this.repository.listAuthorizationRequests();
    return requests.map((request) => this.toManagedAuthorizationRequest(request));
  }

  async submitAuthorizationRequest(
    id: string,
    input: SubmitAuthorizationRequestDto,
    actor: AuthPrincipal,
  ) {
    const user = this.findUserById(id);
    if (!user) {
      throw new NotFoundException({ code: 'IAM_USER_NOT_FOUND', message: '用户不存在' });
    }
    const actualVersion = this.versions.get(id) ?? 1;
    if (input.expectedVersion !== actualVersion) {
      this.versionConflict(input.expectedVersion, actualVersion);
    }
    const areaIds = this.validateAssignment(input.organizationId, input.roleCodes, input.areaIds);
    this.ensureNoSelfLockout(id, input, actor.userId);
    const existing = (await this.repository.listAuthorizationRequests()).find(
      (request) => request.targetUserId === id && request.status === 'pending',
    );
    if (existing) {
      throw new ConflictException({
        code: 'IAM_AUTH_REQUEST_ACTIVE',
        message: '该用户已有待审批的授权变更',
      });
    }
    const timestamp = this.now().toISOString();
    const request: IamAuthorizationRequest = {
      id: `iam-request-${this.createId()}`,
      targetUserId: id,
      requestedById: actor.userId,
      requestedByName: actor.name,
      proposedAuthorization: {
        status: input.status,
        organizationId: input.organizationId,
        roleCodes: [...input.roleCodes],
        areaIds,
      },
      expectedUserVersion: input.expectedVersion,
      reason: input.reason.trim(),
      status: 'pending',
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    try {
      await this.repository.createAuthorizationRequest(request);
      await this.changes.publish('authorization.requested', request.id);
      return this.toManagedAuthorizationRequest(request);
    } catch (error) {
      if (error instanceof IamAuthorizationRequestConflictError) {
        throw new ConflictException({
          code: 'IAM_AUTH_REQUEST_ACTIVE',
          message: '该用户已有待审批的授权变更',
        });
      }
      throw error;
    }
  }

  async reviewAuthorizationRequest(
    id: string,
    input: ReviewAuthorizationRequestDto,
    actor: AuthPrincipal,
  ) {
    const request = (await this.repository.listAuthorizationRequests()).find(
      (item) => item.id === id,
    );
    if (!request) {
      throw new NotFoundException({ code: 'IAM_AUTH_REQUEST_NOT_FOUND', message: '申请不存在' });
    }
    if (request.status !== 'pending' || request.version !== input.expectedVersion) {
      throw new ConflictException({
        code: 'IAM_AUTH_REQUEST_CONFLICT',
        message: '申请状态或版本已变化，请刷新后重试',
      });
    }
    if (request.requestedById === actor.userId) {
      throw new BadRequestException({
        code: 'IAM_DUAL_CONTROL_REQUIRED',
        message: '申请人与审批人必须为不同账号',
      });
    }
    if (input.decision === 'reject' && !input.opinion.trim()) {
      throw new BadRequestException({
        code: 'IAM_REVIEW_OPINION_REQUIRED',
        message: '驳回时必须填写审批意见',
      });
    }
    const reviewedAt = this.now().toISOString();
    const reviewed: IamAuthorizationRequest = {
      ...request,
      status: input.decision === 'approve' ? 'approved' : 'rejected',
      reviewedById: actor.userId,
      reviewedByName: actor.name,
      opinion: input.opinion.trim() || undefined,
      reviewedAt,
      updatedAt: reviewedAt,
    };
    const user = this.findUserById(request.targetUserId);
    if (!user) {
      throw new NotFoundException({ code: 'IAM_USER_NOT_FOUND', message: '用户不存在' });
    }
    let updatedUser: UserAccount | undefined;
    if (input.decision === 'approve') {
      const actualVersion = this.versions.get(user.id) ?? 1;
      if (request.expectedUserVersion !== actualVersion) {
        this.versionConflict(request.expectedUserVersion, actualVersion);
      }
      const proposal = request.proposedAuthorization;
      const areaIds = this.validateAssignment(
        proposal.organizationId,
        proposal.roleCodes,
        proposal.areaIds,
      );
      this.ensureNoSelfLockout(user.id, proposal, actor.userId);
      updatedUser = {
        ...user,
        status: proposal.status,
        organizationId: proposal.organizationId,
        roleCodes: [...proposal.roleCodes],
        areaIds,
      };
    }
    try {
      const result = await this.repository.reviewAuthorizationRequest(
        reviewed,
        input.expectedVersion,
        updatedUser,
      );
      reviewed.version = result.requestVersion;
      if (updatedUser && result.userVersion) {
        Object.assign(user, updatedUser);
        this.versions.set(user.id, result.userVersion);
      }
      await this.changes.publish('authorization.reviewed', reviewed.id);
      return this.toManagedAuthorizationRequest(reviewed);
    } catch (error) {
      if (error instanceof IamAuthorizationRequestNotFoundError) {
        throw new NotFoundException({
          code: 'IAM_AUTH_REQUEST_NOT_FOUND',
          message: '申请不存在',
        });
      }
      if (error instanceof IamAuthorizationRequestVersionConflictError) {
        throw new ConflictException({
          code: 'IAM_AUTH_REQUEST_CONFLICT',
          message: '申请状态或版本已变化，请刷新后重试',
        });
      }
      if (error instanceof IamVersionConflictError) {
        this.versionConflict(error.expectedVersion, error.actualVersion);
      }
      throw error;
    }
  }

  async updatePassword(id: string, password: string, changeRequired: boolean) {
    const user = this.findUserById(id);
    if (!user) {
      throw new NotFoundException({ code: 'IAM_USER_NOT_FOUND', message: '用户不存在' });
    }
    try {
      const passwordHash = hashPassword(password, changeRequired);
      const version = await this.repository.updatePassword(id, passwordHash);
      user.passwordHash = passwordHash;
      user.passwordChangeRequired = changeRequired;
      this.versions.set(id, version);
      await this.changes.publish('user.password.updated', id);
      return this.toManagedUser(user);
    } catch (error) {
      if (error instanceof IamUserNotFoundError) {
        throw new NotFoundException({ code: 'IAM_USER_NOT_FOUND', message: '用户不存在' });
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
      passwordChangeRequired: user.passwordChangeRequired,
    };
  }

  private toManagedUser(user: UserAccount) {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      title: user.title,
      organizationId: user.organizationId,
      status: user.status,
      passwordChangeRequired: user.passwordChangeRequired,
      roleCodes: [...user.roleCodes],
      areaIds: [...user.areaIds],
      version: this.versions.get(user.id) ?? 1,
      organization: this.organizations.find((item) => item.id === user.organizationId),
      roles: this.roles
        .filter((role) => user.roleCodes.includes(role.code))
        .map((role) => ({ ...role, permissions: [...role.permissions] })),
    };
  }

  private toManagedRole(role: Role) {
    return {
      ...role,
      permissions: [...role.permissions],
      editable: this.isCustomRole(role),
      assignedUserCount: this.accounts.filter((user) => user.roleCodes.includes(role.code)).length,
    };
  }

  private toManagedAuthorizationRequest(request: IamAuthorizationRequest) {
    return {
      ...request,
      proposedAuthorization: {
        ...request.proposedAuthorization,
        roleCodes: [...request.proposedAuthorization.roleCodes],
        areaIds: [...request.proposedAuthorization.areaIds],
      },
      targetUser: this.accounts
        .filter((user) => user.id === request.targetUserId)
        .map((user) => this.toManagedUser(user))[0],
    };
  }

  private isCustomRole(role: Role) {
    return role.id.startsWith('role-custom-');
  }

  private ensureNoSelfLockout(
    targetUserId: string,
    input: Pick<UpdateUserAuthorizationDto, 'status' | 'roleCodes'>,
    actorId: string,
  ) {
    if (
      actorId === targetUserId &&
      (input.status === 'disabled' || !input.roleCodes.includes('system_admin'))
    ) {
      throw new BadRequestException({
        code: 'IAM_SELF_LOCKOUT',
        message: '不能停用当前账号或移除自己的系统管理员角色',
      });
    }
  }

  private validateAssignment(organizationId: string, roleCodes: string[], areaIds: string[]) {
    if (!this.organizations.some((item) => item.id === organizationId)) {
      throw new BadRequestException({
        code: 'IAM_ORGANIZATION_INVALID',
        message: '所属组织不存在',
      });
    }
    const assignedRoles = roleCodes.map((code) => this.roles.find((role) => role.code === code));
    if (assignedRoles.some((role) => !role)) {
      throw new BadRequestException({ code: 'IAM_ROLE_INVALID', message: '包含无效角色' });
    }
    if (areaIds.some((areaId) => !this.areas.some((area) => area.id === areaId))) {
      throw new BadRequestException({ code: 'IAM_AREA_INVALID', message: '包含无效区域' });
    }
    const isAllScope = assignedRoles.some((role) => role?.dataScope === 'all');
    if (!isAllScope && areaIds.length === 0) {
      throw new BadRequestException({
        code: 'IAM_AREA_REQUIRED',
        message: '区域数据权限角色至少需要分配一个区域',
      });
    }
    return isAllScope ? [] : [...areaIds];
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
      passwordHash: user.passwordHash,
      passwordChangeRequired:
        user.passwordChangeRequired ?? requiresPasswordChange(user.passwordHash),
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

  private refreshSnapshot() {
    const refresh = this.refreshChain.then(async () => {
      this.replaceSnapshot(await this.repository.loadSnapshot());
    });
    this.refreshChain = refresh.catch(() => undefined);
    return refresh;
  }

  private versionConflict(expectedVersion: number, actualVersion: number): never {
    throw new ConflictException({
      code: 'VERSION_CONFLICT',
      message: '用户授权已被其他管理员更新，请刷新后重试',
      details: { expectedVersion, actualVersion },
    });
  }
}
