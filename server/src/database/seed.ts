import {
  Prisma,
  PrismaClient,
  type DataScope,
  type RiskLevel,
  type UserStatus,
} from '@prisma/client';
import { hashPassword } from '../modules/auth/auth.service';
import { areas, organizations, roles, users } from '../modules/iam/iam.seed';
import { riskSeed } from '../modules/risks/risk.seed';
import { hazardSeed } from '../modules/hazards/hazard.seed';
import { workPermitSeed } from '../modules/work-permits/work-permit.seed';
import { warningRuleSeed } from '../modules/warning-rules/warning-rule.seed';
import { emergencyEventSeed } from '../modules/emergency-events/emergency-event.seed';
import { emergencyPlanSeed } from '../modules/emergency-plans/emergency-plan.seed';
import { emergencyResourceSeed } from '../modules/emergency-resources/emergency-resource.seed';

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

  for (const permit of workPermitSeed) {
    const data = {
      code: permit.code,
      type: permit.type,
      areaId: permit.areaId,
      areaName: permit.areaName,
      workContent: permit.workContent,
      applicantId: permit.applicantId,
      applicant: permit.applicant,
      guardian: permit.guardian,
      startAt: new Date(`${permit.startAt.replace(' ', 'T')}:00.000Z`),
      endAt: new Date(`${permit.endAt.replace(' ', 'T')}:00.000Z`),
      riskLevel: permit.riskLevel,
      status: permit.status,
      gasTest: permit.gasTest,
      linkedGdsCodes: permit.linkedGdsCodes,
      safetyMeasures: permit.safetyMeasures,
      alertReason: permit.alertReason,
      workX: permit.workX,
      workY: permit.workY,
      version: permit.version,
    };
    await prisma.workPermit.upsert({
      where: { id: permit.id },
      update: data,
      create: { id: permit.id, ...data },
    });
    for (const step of permit.approvalSteps) {
      await prisma.workPermitApprovalStep.upsert({
        where: { id: step.id },
        update: {
          sequence: step.sequence,
          role: step.role,
          approverId: step.approverId,
          approver: step.approver,
          status: step.status,
          signedAt: step.signedAt ? new Date(step.signedAt) : undefined,
          signature: step.signature,
        },
        create: {
          ...step,
          signedAt: step.signedAt ? new Date(step.signedAt) : undefined,
          workPermitId: permit.id,
        },
      });
    }
    for (const confirmation of permit.siteConfirmations) {
      await prisma.workPermitSiteConfirmation.upsert({
        where: { id: confirmation.id },
        update: {
          role: confirmation.role,
          confirmerId: confirmation.confirmerId,
          confirmer: confirmation.confirmer,
          confirmedAt: new Date(confirmation.confirmedAt),
        },
        create: {
          ...confirmation,
          confirmedAt: new Date(confirmation.confirmedAt),
          workPermitId: permit.id,
        },
      });
    }
  }

  for (const rule of warningRuleSeed) {
    const config = {
      name: rule.name,
      source: rule.source,
      scenario: rule.scenario,
      level: rule.level as RiskLevel,
      scope: rule.scope,
      condition: rule.condition,
      duration: rule.duration,
      notifyTargets: rule.notifyTargets,
      description: rule.description,
      expression: rule.expression as unknown as Prisma.InputJsonValue,
      rolloutPercentage: rule.rolloutPercentage,
    };
    await prisma.warningRule.upsert({
      where: { id: rule.id },
      update: {
        code: rule.code,
        ...config,
        enabled: rule.enabled,
        triggerCount: rule.triggerCount,
        lastTriggeredAt: rule.lastTriggeredAt ? new Date(rule.lastTriggeredAt) : undefined,
        publishStatus: rule.publishStatus,
        version: rule.version,
        revision: rule.revision,
      },
      create: {
        id: rule.id,
        code: rule.code,
        ...config,
        enabled: rule.enabled,
        triggerCount: rule.triggerCount,
        lastTriggeredAt: rule.lastTriggeredAt ? new Date(rule.lastTriggeredAt) : undefined,
        publishStatus: rule.publishStatus,
        version: rule.version,
        revision: rule.revision,
      },
    });
    for (const version of rule.versions) {
      await prisma.warningRuleVersion.upsert({
        where: { id: version.id },
        update: {
          version: version.version,
          name: version.name,
          source: version.source,
          scenario: version.scenario,
          level: version.level as RiskLevel,
          scope: version.scope,
          condition: version.condition,
          duration: version.duration,
          notifyTargets: version.notifyTargets,
          description: version.description,
          expression: version.expression as unknown as Prisma.InputJsonValue,
          rolloutPercentage: version.rolloutPercentage,
          publishedAt: new Date(version.publishedAt),
          publisherId: version.publisherId,
          publisher: version.publisher,
        },
        create: {
          id: version.id,
          warningRuleId: rule.id,
          version: version.version,
          name: version.name,
          source: version.source,
          scenario: version.scenario,
          level: version.level as RiskLevel,
          scope: version.scope,
          condition: version.condition,
          duration: version.duration,
          notifyTargets: version.notifyTargets,
          description: version.description,
          expression: version.expression as unknown as Prisma.InputJsonValue,
          rolloutPercentage: version.rolloutPercentage,
          publishedAt: new Date(version.publishedAt),
          publisherId: version.publisherId,
          publisher: version.publisher,
        },
      });
    }
  }

  for (const event of emergencyEventSeed) {
    const data = {
      eventId: event.eventId,
      code: event.code,
      title: event.title,
      areaId: event.areaId,
      areaName: event.areaName,
      source: event.source,
      status: event.status,
      responseLevel: event.responseLevel,
      commander: event.commander,
      ownerDepartment: event.ownerDepartment,
      startedAt: new Date(event.startedAt),
      summary: event.summary,
      operations: event.operations as unknown as Prisma.InputJsonValue,
      evidence: event.evidence as unknown as Prisma.InputJsonValue,
      closureWorkflowId: event.closureWorkflowId,
      version: event.version,
      updatedAt: new Date(event.updatedAt),
    };
    await prisma.emergencyEvent.upsert({
      where: { id: event.id },
      update: data,
      create: {
        id: event.id,
        ...data,
        closureApproval: event.closureApproval
          ? (event.closureApproval as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        createdAt: new Date(event.createdAt),
      },
    });
  }

  for (const plan of emergencyPlanSeed) {
    const config = { name: plan.name, category: plan.category, eventType: plan.eventType, applicableArea: plan.applicableArea, medium: plan.medium, responseLevel: plan.responseLevel, triggerRule: plan.triggerRule, notificationTargets: plan.notificationTargets, steps: plan.steps, resources: plan.resources, effectiveDate: plan.effectiveDate, expiryDate: plan.expiryDate, ownerDepartment: plan.ownerDepartment };
    await prisma.emergencyPlanTemplate.upsert({ where: { id: plan.id }, update: { code: plan.code, config, version: plan.version, status: plan.status, publishStatus: plan.publishStatus, versions: plan.versions as unknown as Prisma.InputJsonValue, drills: plan.drills as unknown as Prisma.InputJsonValue, revision: plan.revision }, create: { id: plan.id, code: plan.code, config, version: plan.version, status: plan.status, publishStatus: plan.publishStatus, draft: Prisma.JsonNull, versions: plan.versions as unknown as Prisma.InputJsonValue, reviewSteps: Prisma.JsonNull, drills: plan.drills as unknown as Prisma.InputJsonValue, revision: plan.revision } });
  }

  for (const resource of emergencyResourceSeed) {
    const data = { code: resource.code, name: resource.name, type: resource.type, totalQuantity: resource.totalQuantity, availableQuantity: resource.availableQuantity, unit: resource.unit, location: resource.location, eta: resource.eta, status: resource.status, owner: resource.owner, contact: resource.contact, lastInspection: resource.lastInspection, nextInspection: resource.nextInspection, inspectionStatus: resource.inspectionStatus, batches: resource.batches as unknown as Prisma.InputJsonValue, dispatches: resource.dispatches as unknown as Prisma.InputJsonValue, inspectionRecords: resource.inspectionRecords as unknown as Prisma.InputJsonValue, version: resource.version };
    await prisma.emergencyResourceInventory.upsert({ where: { id: resource.id }, update: data, create: { id: resource.id, ...data, createdAt: new Date(resource.createdAt), updatedAt: new Date(resource.updatedAt) } });
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
