import { Prisma, PrismaClient, type DataScope, type RiskLevel, type UserStatus } from '@prisma/client';
import { hashPassword } from '../modules/auth/auth.service';
import { areas, organizations, roles, users } from '../modules/iam/iam.seed';
import { riskSeed } from '../modules/risks/risk.seed';

const prisma = new PrismaClient();

async function main() {
  for (const organization of organizations) {
    await prisma.organization.upsert({
      where: { id: organization.id },
      update: organization,
      create: organization,
    });
  }

  for (const area of areas) {
    await prisma.area.upsert({
      where: { id: area.id },
      update: area,
      create: area,
    });
  }

  for (const role of roles) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: { ...role, dataScope: role.dataScope as DataScope },
      create: { ...role, dataScope: role.dataScope as DataScope },
    });
  }

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        username: user.username,
        name: user.name,
        title: user.title,
        organizationId: user.organizationId,
        status: user.status as UserStatus,
      },
      create: {
        id: user.id,
        username: user.username,
        passwordHash: hashPassword('ant.design'),
        name: user.name,
        title: user.title,
        organizationId: user.organizationId,
        status: user.status as UserStatus,
      },
    });
    for (const roleCode of user.roleCodes) {
      const role = roles.find((item) => item.code === roleCode);
      if (!role) continue;
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id },
      });
    }
    for (const areaId of user.areaIds) {
      await prisma.userAreaAssignment.upsert({
        where: { userId_areaId: { userId: user.id, areaId } },
        update: {},
        create: { userId: user.id, areaId },
      });
    }
  }

  for (const risk of riskSeed) {
    await prisma.riskUnit.upsert({
      where: { code: risk.code },
      update: {
        name: risk.name,
        parentName: risk.parentName,
        areaId: risk.areaId,
        areaName: risk.areaName,
        ownerDepartment: risk.ownerDepartment,
        owner: risk.owner,
        medium: risk.medium,
        accidentTypes: risk.accidentTypes,
        staticLevel: risk.staticLevel as RiskLevel,
        currentLevel: risk.currentLevel as RiskLevel,
        controls: risk.controls,
        linkedGds: risk.linkedGds,
        linkedVoc: risk.linkedVoc,
        linkedMes: risk.linkedMes,
        linkedPlans: risk.linkedPlans,
        dynamicFactors: risk.dynamicFactors as unknown as Prisma.InputJsonValue,
      },
      create: {
        id: risk.id,
        code: risk.code,
        name: risk.name,
        parentName: risk.parentName,
        areaId: risk.areaId,
        areaName: risk.areaName,
        ownerDepartment: risk.ownerDepartment,
        owner: risk.owner,
        medium: risk.medium,
        accidentTypes: risk.accidentTypes,
        staticLevel: risk.staticLevel as RiskLevel,
        currentLevel: risk.currentLevel as RiskLevel,
        controls: risk.controls,
        linkedGds: risk.linkedGds,
        linkedVoc: risk.linkedVoc,
        linkedMes: risk.linkedMes,
        linkedPlans: risk.linkedPlans,
        dynamicFactors: risk.dynamicFactors as unknown as Prisma.InputJsonValue,
        version: risk.version,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
