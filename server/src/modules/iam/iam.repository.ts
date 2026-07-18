import type {
  AreaAssignment,
  IamAuthorizationRequest,
  Organization,
  Role,
  UserAccount,
} from './iam.types';

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
export class IamUsernameConflictError extends Error {}
export class IamRoleNotFoundError extends Error {}
export class IamRoleCodeConflictError extends Error {}
export class IamAuthorizationRequestNotFoundError extends Error {}
export class IamAuthorizationRequestConflictError extends Error {}
export class IamAuthorizationRequestVersionConflictError extends Error {}

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
  createUser(user: UserAccount): Promise<number>;
  createRole(role: Role): Promise<void>;
  updateRole(role: Role): Promise<void>;
  listAuthorizationRequests(): Promise<IamAuthorizationRequest[]>;
  createAuthorizationRequest(request: IamAuthorizationRequest): Promise<void>;
  reviewAuthorizationRequest(
    request: IamAuthorizationRequest,
    expectedRequestVersion: number,
    updatedUser?: UserAccount,
  ): Promise<{ requestVersion: number; userVersion?: number }>;
  updatePassword(userId: string, passwordHash: string): Promise<number>;
  updateUserAuthorization(user: UserAccount, expectedVersion: number): Promise<number>;
}
