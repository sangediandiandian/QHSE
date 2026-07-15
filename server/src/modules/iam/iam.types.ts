export const permissions = [
  'risk:read',
  'risk:assess',
  'risk:controls:update',
  'hazard:read',
  'hazard:report',
  'hazard:rectify',
  'hazard:accept',
  'hazard:supervise',
  'permit:read',
  'permit:apply',
  'permit:approve',
  'permit:confirm',
  'permit:control',
  'warning:read',
  'warning:edit',
  'warning:submit',
  'warning:approve',
  'warning:toggle',
  'warning:evaluate',
  'emergency:read',
  'emergency:manage',
  'emergency:evidence',
  'emergency:approve',
  'plan:read',
  'plan:edit',
  'plan:submit',
  'plan:approve',
  'plan:drill',
  'resource:read',
  'resource:manage',
  'resource:dispatch',
  'resource:inspect',
  'communication:read',
  'communication:send',
  'communication:confirm',
  'iam:read',
  'iam:manage',
  'audit:read',
] as const;

export type Permission = (typeof permissions)[number];
export type DataScope = 'all' | 'assigned_areas';

export interface Organization {
  id: string;
  parentId?: string;
  code: string;
  name: string;
  type: '企业' | '职能部门' | '生产单位';
}

export interface AreaAssignment {
  id: string;
  code: string;
  name: string;
  organizationId: string;
}

export interface Role {
  id: string;
  code: string;
  name: string;
  permissions: Permission[];
  dataScope: DataScope;
}

export interface UserAccount {
  id: string;
  username: string;
  name: string;
  title: string;
  organizationId: string;
  roleCodes: string[];
  areaIds: string[];
  status: 'enabled' | 'disabled';
}

export interface AuthPrincipal {
  userId: string;
  username: string;
  name: string;
  organizationId: string;
  roles: string[];
  permissions: Permission[];
  dataScope: DataScope;
  areaIds: string[];
}
