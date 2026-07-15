import { Injectable } from '@nestjs/common';
import { areas, organizations, roles, users } from './iam.seed';
import type { AuthPrincipal, Permission, UserAccount } from './iam.types';

@Injectable()
export class IamService {
  listOrganizations() {
    return organizations.map((organization) => ({
      ...organization,
      areas: areas.filter((area) => area.organizationId === organization.id),
    }));
  }

  listRoles() {
    return structuredClone(roles);
  }

  listUsers() {
    return users.map((user) => ({
      ...structuredClone(user),
      organization: organizations.find((item) => item.id === user.organizationId),
      roles: roles.filter((role) => user.roleCodes.includes(role.code)),
    }));
  }

  findUserByUsername(username: string) {
    return users.find((user) => user.username === username);
  }

  findUserById(id: string) {
    return users.find((user) => user.id === id);
  }

  createPrincipal(user: UserAccount): AuthPrincipal {
    const assignedRoles = roles.filter((role) => user.roleCodes.includes(role.code));
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
    };
  }
}
