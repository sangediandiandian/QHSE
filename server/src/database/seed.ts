import { Prisma, PrismaClient, type DataScope, type RiskLevel, type UserStatus } from '@prisma/client';
import { hashPassword } from '../modules/auth/auth.service';
import { areas, organizations, roles, users } from '../modules/iam/iam.seed';
import { riskSeed } from '../modules/risks/risk.seed';
import { hazardSeed } from '../modules/hazards/hazard.seed';

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

  for (const hazard of hazardSeed) {
    await prisma.hazard.upsert({
      where: { id: hazard.id },
      update: {
        code: hazard.code,
        title: hazard.title,
        areaId: hazard.areaId,
        areaName: hazard.areaName,
        level: hazard.level,
        source: hazard.source,
        category: hazard.category,
        ownerDepartment: hazard.ownerDepartment,
        owner: hazard.owner,
        discoveredAt: new Date(`${hazard.discoveredAt}T00:00:00.000Z`),
        deadline: new Date(`${hazard.deadline}T00:00:00.000Z`),
        status: hazard.status,
        riskUnitId: hazard.riskUnitId,
        recurrenceCount: hazard.recurrenceCount,
        description: hazard.description,
        measures: hazard.measures,
        supervised: hazard.supervised,
        acceptanceOpinion: hazard.acceptanceOpinion,
        version: hazard.version,
      },
      create: {
        id: hazard.id,
        code: hazard.code,
        title: hazard.title,
        areaId: hazard.areaId,
        areaName: hazard.areaName,
        level: hazard.level,
        source: hazard.source,
        category: hazard.category,
        ownerDepartment: hazard.ownerDepartment,
        owner: hazard.owner,
        discoveredAt: new Date(`${hazard.discoveredAt}T00:00:00.000Z`),
        deadline: new Date(`${hazard.deadline}T00:00:00.000Z`),
        status: hazard.status,
        riskUnitId: hazard.riskUnitId,
        recurrenceCount: hazard.recurrenceCount,
        description: hazard.description,
        measures: hazard.measures,
        supervised: hazard.supervised,
        acceptanceOpinion: hazard.acceptanceOpinion,
        version: hazard.version,
      },
    });
    for (const evidence of hazard.evidence) {
      await prisma.hazardEvidence.upsert({
        where: { id: evidence.id },
        update: {
          name: evidence.name,
          category: evidence.category,
          uploaderId: evidence.uploaderId,
          uploader: evidence.uploader,
          uploadedAt: new Date(evidence.uploadedAt),
          note: evidence.note,
        },
        create: {
          ...evidence,
          uploadedAt: new Date(evidence.uploadedAt),
          hazardId: hazard.id,
        },
      });
    }
    for (const operation of hazard.operations) {
      await prisma.hazardOperation.upsert({
        where: { id: operation.id },
        update: {
          action: operation.action,
          operatorId: operation.operatorId,
          operator: operation.operator,
          operatedAt: new Date(operation.operatedAt),
          detail: operation.detail,
        },
        create: {
          ...operation,
          operatedAt: new Date(operation.operatedAt),
          hazardId: hazard.id,
        },
      });
    }
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
