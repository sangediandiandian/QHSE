import type { IamOrganization, IamRole, IamUser } from '@/types/qhse';
import { request } from '@umijs/max';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  requestId: string;
  timestamp: string;
}

export interface UserAuthorizationInput {
  status: IamUser['status'];
  organizationId: string;
  roleCodes: string[];
  areaIds: string[];
}

export interface CreateIamUserInput {
  username: string;
  name: string;
  title: string;
  initialPassword: string;
  organizationId: string;
  roleCodes: string[];
  areaIds: string[];
}

export interface IamRoleInput {
  name: string;
  permissions: string[];
  dataScope: IamRole['dataScope'];
}

export interface CreateIamRoleInput extends IamRoleInput {
  code: string;
}

export async function getIamOverview() {
  const [organizations, roles, users] = await Promise.all([
    request<ApiResponse<IamOrganization[]>>('/api/v1/iam/organizations', { method: 'GET' }),
    request<ApiResponse<IamRole[]>>('/api/v1/iam/roles', { method: 'GET' }),
    request<ApiResponse<IamUser[]>>('/api/v1/iam/users', { method: 'GET' }),
  ]);
  return {
    organizations: organizations.data,
    roles: roles.data,
    users: users.data,
  };
}

export async function updateUserAuthorization(user: IamUser, input: UserAuthorizationInput) {
  const response = await request<ApiResponse<IamUser>>(
    `/api/v1/iam/users/${user.id}/authorization`,
    {
      method: 'PUT',
      data: { ...input, expectedVersion: user.version },
    },
  );
  return response.data;
}

export async function createIamUser(input: CreateIamUserInput) {
  const response = await request<ApiResponse<IamUser>>('/api/v1/iam/users', {
    method: 'POST',
    data: input,
  });
  return response.data;
}

export async function resetIamUserPassword(userId: string, temporaryPassword: string) {
  const response = await request<
    ApiResponse<{ passwordReset: boolean; passwordChangeRequired: boolean; user: IamUser }>
  >(`/api/v1/auth/users/${userId}/password-reset`, {
    method: 'PUT',
    data: { temporaryPassword },
  });
  return response.data;
}

export async function createIamRole(input: CreateIamRoleInput) {
  const response = await request<ApiResponse<IamRole>>('/api/v1/iam/roles', {
    method: 'POST',
    data: input,
  });
  return response.data;
}

export async function updateIamRole(roleId: string, input: IamRoleInput) {
  const response = await request<ApiResponse<IamRole>>(`/api/v1/iam/roles/${roleId}`, {
    method: 'PUT',
    data: input,
  });
  return response.data;
}
