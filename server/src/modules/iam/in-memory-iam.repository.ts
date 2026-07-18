import { Injectable } from '@nestjs/common';
import { areas, organizations, roles, users } from './iam.seed';
import {
  type IamRepository,
  IamUserNotFoundError,
  IamUsernameConflictError,
  IamVersionConflictError,
  type VersionedUserAccount,
} from './iam.repository';
import type { UserAccount } from './iam.types';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

@Injectable()
export class InMemoryIamRepository implements IamRepository {
  private readonly accounts = new Map<string, VersionedUserAccount>(
    users.map((user) => [user.id, { ...clone(user), version: 1 }]),
  );

  async loadSnapshot() {
    return clone({
      organizations,
      areas,
      roles,
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
}
