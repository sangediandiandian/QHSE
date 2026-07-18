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
