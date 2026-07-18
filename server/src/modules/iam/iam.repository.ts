import type { AreaAssignment, Organization, Role, UserAccount } from './iam.types';

export interface VersionedUserAccount extends UserAccount {
  version: number;
}

export interface IamSnapshot {
  organizations: Organization[];
  areas: AreaAssignment[];
  roles: Role[];
  users: VersionedUserAccount[];
}

export class IamUserNotFoundError extends Error {}

export class IamVersionConflictError extends Error {
  constructor(
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
  ) {
    super('IAM user authorization version conflict');
  }
}

export interface IamRepository {
  loadSnapshot(): Promise<IamSnapshot>;
  updateUserAuthorization(user: UserAccount, expectedVersion: number): Promise<number>;
}
