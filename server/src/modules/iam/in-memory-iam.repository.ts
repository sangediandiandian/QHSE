import { Injectable } from '@nestjs/common';
import { areas, organizations, roles, users } from './iam.seed';
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
  type VersionedUserAccount,
} from './iam.repository';
import type { IamAuthorizationRequest, Role, UserAccount } from './iam.types';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

@Injectable()
export class InMemoryIamRepository implements IamRepository {
  private readonly accounts = new Map<string, VersionedUserAccount>(
    users.map((user) => [user.id, { ...clone(user), version: 1 }]),
  );
  private readonly roleRecords = new Map<string, Role>(roles.map((role) => [role.id, clone(role)]));
  private readonly authorizationRequests = new Map<string, IamAuthorizationRequest>();

  async loadSnapshot() {
    return clone({
      organizations,
      areas,
      roles: [...this.roleRecords.values()],
      users: [...this.accounts.values()],
    });
  }

  async updateUserAuthorization(user: UserAccount, expectedVersion: number) {
    const current = this.accounts.get(user.id);
    if (!current) throw new IamUserNotFoundError();
    if (current.version !== expectedVersion) {
      throw new IamVersionConflictError(expectedVersion, current.version);
    }
    const version = current.version + 1;
    this.accounts.set(user.id, { ...clone(user), version });
    return version;
  }

  async createUser(user: UserAccount) {
    if (
      [...this.accounts.values()].some(
        (item) => item.username.toLowerCase() === user.username.toLowerCase(),
      )
    ) {
      throw new IamUsernameConflictError();
    }
    this.accounts.set(user.id, { ...clone(user), version: 1 });
    return 1;
  }

  async updatePassword(userId: string, passwordHash: string) {
    const current = this.accounts.get(userId);
    if (!current) throw new IamUserNotFoundError();
    const version = current.version + 1;
    this.accounts.set(userId, {
      ...current,
      passwordHash,
      passwordChangeRequired: passwordHash.startsWith('scrypt-change$'),
      version,
    });
    return version;
  }

  async createRole(role: Role) {
    if (
      [...this.roleRecords.values()].some(
        (item) => item.code.toLowerCase() === role.code.toLowerCase(),
      )
    ) {
      throw new IamRoleCodeConflictError();
    }
    this.roleRecords.set(role.id, clone(role));
  }

  async updateRole(role: Role) {
    if (!this.roleRecords.has(role.id)) throw new IamRoleNotFoundError();
    this.roleRecords.set(role.id, clone(role));
  }

  async listAuthorizationRequests() {
    return clone(
      [...this.authorizationRequests.values()].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    );
  }

  async createAuthorizationRequest(request: IamAuthorizationRequest) {
    if (
      [...this.authorizationRequests.values()].some(
        (item) => item.targetUserId === request.targetUserId && item.status === 'pending',
      )
    ) {
      throw new IamAuthorizationRequestConflictError();
    }
    this.authorizationRequests.set(request.id, clone(request));
  }

  async reviewAuthorizationRequest(
    request: IamAuthorizationRequest,
    expectedRequestVersion: number,
    updatedUser?: UserAccount,
  ) {
    const current = this.authorizationRequests.get(request.id);
    if (!current) throw new IamAuthorizationRequestNotFoundError();
    if (current.version !== expectedRequestVersion || current.status !== 'pending') {
      throw new IamAuthorizationRequestVersionConflictError();
    }
    let userVersion: number | undefined;
    if (updatedUser) {
      const user = this.accounts.get(updatedUser.id);
      if (!user) throw new IamUserNotFoundError();
      if (user.version !== request.expectedUserVersion) {
        throw new IamVersionConflictError(request.expectedUserVersion, user.version);
      }
      userVersion = user.version + 1;
      this.accounts.set(updatedUser.id, { ...clone(updatedUser), version: userVersion });
    }
    const requestVersion = current.version + 1;
    this.authorizationRequests.set(request.id, { ...clone(request), version: requestVersion });
    return { requestVersion, userVersion };
  }
}
