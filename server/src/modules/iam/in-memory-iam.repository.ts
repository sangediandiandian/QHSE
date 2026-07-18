import { Injectable } from '@nestjs/common';
import { areas, organizations, roles, users } from './iam.seed';
import {
  type IamRepository,
  IamRoleCodeConflictError,
  IamRoleNotFoundError,
  IamUserNotFoundError,
  IamUsernameConflictError,
  IamVersionConflictError,
  type VersionedUserAccount,
} from './iam.repository';
import type { Role, UserAccount } from './iam.types';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

@Injectable()
export class InMemoryIamRepository implements IamRepository {
  private readonly accounts = new Map<string, VersionedUserAccount>(
    users.map((user) => [user.id, { ...clone(user), version: 1 }]),
  );
  private readonly roleRecords = new Map<string, Role>(roles.map((role) => [role.id, clone(role)]));

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
}
