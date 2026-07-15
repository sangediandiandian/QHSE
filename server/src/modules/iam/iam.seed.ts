import type { AreaAssignment, Organization, Role, UserAccount } from './iam.types';

export const organizations: Organization[] = [
  { id: 'org-enterprise', code: 'QHSE-CORP', name: '示范炼化企业', type: '企业' },
  { id: 'org-qhse', parentId: 'org-enterprise', code: 'QHSE-DEPT', name: 'QHSE 管理部', type: '职能部门' },
  { id: 'org-production', parentId: 'org-enterprise', code: 'PROD-DEPT', name: '生产运行部', type: '职能部门' },
  { id: 'org-environment', parentId: 'org-enterprise', code: 'ENV-DEPT', name: '环保管理部', type: '职能部门' },
  { id: 'org-fcc', parentId: 'org-enterprise', code: 'FCC-UNIT', name: '催化裂化装置', type: '生产单位' },
  { id: 'org-storage', parentId: 'org-enterprise', code: 'STORAGE-UNIT', name: '储运部', type: '生产单位' },
];

export const areas: AreaAssignment[] = [
  { id: 'area-01', code: 'CDU', name: '常减压装置', organizationId: 'org-production' },
  { id: 'area-02', code: 'FCC', name: '催化裂化装置', organizationId: 'org-fcc' },
  { id: 'area-03', code: 'HCU', name: '加氢装置', organizationId: 'org-production' },
  { id: 'area-04', code: 'SRU', name: '硫磺回收装置', organizationId: 'org-environment' },
  { id: 'area-05', code: 'TANK', name: '储罐区', organizationId: 'org-storage' },
  { id: 'area-06', code: 'LOAD', name: '油品装卸区', organizationId: 'org-storage' },
];

export const roles: Role[] = [
  { id: 'role-leader', code: 'enterprise_leader', name: '企业领导', permissions: ['risk:read', 'hazard:read', 'permit:read', 'permit:approve', 'warning:read', 'emergency:read', 'plan:read', 'resource:read', 'communication:read'], dataScope: 'all' },
  { id: 'role-qhse', code: 'qhse_manager', name: 'QHSE 管理人员', permissions: ['risk:read', 'risk:assess', 'risk:controls:update', 'hazard:read', 'hazard:report', 'hazard:rectify', 'hazard:accept', 'hazard:supervise', 'permit:read', 'permit:apply', 'permit:approve', 'permit:control', 'warning:read', 'warning:edit', 'warning:submit', 'warning:approve', 'warning:toggle', 'warning:evaluate', 'emergency:read', 'emergency:manage', 'emergency:evidence', 'emergency:approve', 'plan:read', 'plan:edit', 'plan:submit', 'plan:approve', 'plan:drill', 'resource:read', 'resource:manage', 'resource:dispatch', 'resource:inspect', 'communication:read', 'communication:send', 'communication:confirm', 'audit:read'], dataScope: 'all' },
  { id: 'role-dispatcher', code: 'production_dispatcher', name: '生产调度人员', permissions: ['risk:read', 'hazard:read', 'hazard:report', 'permit:read', 'permit:apply', 'permit:approve', 'permit:control', 'warning:read', 'warning:approve', 'warning:evaluate', 'emergency:read', 'emergency:manage', 'emergency:evidence', 'plan:read', 'plan:approve', 'plan:drill', 'resource:read', 'resource:dispatch', 'resource:inspect', 'communication:read', 'communication:send', 'communication:confirm'], dataScope: 'all' },
  { id: 'role-unit-manager', code: 'unit_manager', name: '装置负责人', permissions: ['risk:read', 'risk:assess', 'risk:controls:update', 'hazard:read', 'hazard:report', 'hazard:rectify', 'permit:read', 'permit:apply', 'permit:approve', 'permit:confirm', 'permit:control', 'warning:read', 'emergency:read', 'emergency:manage', 'emergency:evidence', 'plan:read', 'plan:drill', 'resource:read', 'resource:inspect', 'communication:read', 'communication:confirm'], dataScope: 'assigned_areas' },
  { id: 'role-operator', code: 'operator', name: '岗位操作人员', permissions: ['risk:read', 'hazard:read', 'hazard:report', 'hazard:rectify', 'permit:read', 'permit:apply', 'permit:confirm', 'warning:read', 'emergency:read', 'emergency:evidence', 'resource:read', 'communication:read', 'communication:confirm'], dataScope: 'assigned_areas' },
  { id: 'role-environment', code: 'environment_manager', name: '环保管理人员', permissions: ['risk:read', 'hazard:read', 'hazard:report', 'hazard:rectify', 'permit:read', 'permit:apply', 'permit:approve', 'permit:confirm', 'warning:read', 'emergency:read', 'emergency:manage', 'emergency:evidence', 'resource:read', 'resource:inspect', 'communication:read', 'communication:confirm'], dataScope: 'assigned_areas' },
  { id: 'role-emergency', code: 'emergency_commander', name: '应急指挥人员', permissions: ['risk:read', 'hazard:read', 'permit:read', 'warning:read', 'emergency:read', 'emergency:manage', 'emergency:evidence', 'plan:read', 'plan:drill', 'resource:read', 'resource:dispatch', 'resource:inspect', 'communication:read', 'communication:send', 'communication:confirm'], dataScope: 'all' },
  { id: 'role-admin', code: 'system_admin', name: '系统管理员', permissions: ['risk:read', 'risk:assess', 'risk:controls:update', 'hazard:read', 'hazard:report', 'hazard:rectify', 'hazard:accept', 'hazard:supervise', 'permit:read', 'permit:apply', 'permit:approve', 'permit:confirm', 'permit:control', 'warning:read', 'warning:edit', 'warning:submit', 'warning:approve', 'warning:toggle', 'warning:evaluate', 'emergency:read', 'emergency:manage', 'emergency:evidence', 'emergency:approve', 'plan:read', 'plan:edit', 'plan:submit', 'plan:approve', 'plan:drill', 'resource:read', 'resource:manage', 'resource:dispatch', 'resource:inspect', 'communication:read', 'communication:send', 'communication:confirm', 'iam:read', 'iam:manage', 'audit:read'], dataScope: 'all' },
];

export const users: UserAccount[] = [
  { id: 'user-admin', username: 'admin', name: '系统管理员', title: '平台管理员', organizationId: 'org-qhse', roleCodes: ['system_admin'], areaIds: [], status: 'enabled' },
  { id: 'user-leader', username: 'leader', name: '刘总', title: '企业领导', organizationId: 'org-enterprise', roleCodes: ['enterprise_leader'], areaIds: [], status: 'enabled' },
  { id: 'user-qhse', username: 'qhse', name: '赵磊', title: 'QHSE 管理员', organizationId: 'org-qhse', roleCodes: ['qhse_manager'], areaIds: [], status: 'enabled' },
  { id: 'user-dispatcher', username: 'dispatcher', name: '陈涛', title: '生产调度', organizationId: 'org-production', roleCodes: ['production_dispatcher'], areaIds: [], status: 'enabled' },
  { id: 'user-unit', username: 'unit_manager', name: '李建国', title: '装置负责人', organizationId: 'org-fcc', roleCodes: ['unit_manager'], areaIds: ['area-02'], status: 'enabled' },
  { id: 'user-operator', username: 'operator', name: '王强', title: '岗位操作员', organizationId: 'org-fcc', roleCodes: ['operator'], areaIds: ['area-02'], status: 'enabled' },
  { id: 'user-environment', username: 'environment', name: '周敏', title: '环保管理员', organizationId: 'org-environment', roleCodes: ['environment_manager'], areaIds: ['area-04'], status: 'enabled' },
  { id: 'user-emergency', username: 'commander', name: '马会军', title: '应急指挥', organizationId: 'org-production', roleCodes: ['emergency_commander'], areaIds: [], status: 'enabled' },
];
