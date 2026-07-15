import { Injectable } from '@nestjs/common';
import { Prisma, type RiskLevel as PrismaRiskLevel } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  type WarningRuleRepository,
  WarningRuleCodeConflictError,
  WarningRuleNotFoundError,
  WarningRuleRevisionConflictError,
} from './warning-rule.repository';
import type {
  WarningRule,
  WarningRuleConfig,
  WarningRuleExpressionItem,
  WarningRuleQuery,
  WarningRuleUpdate,
} from './warning-rule.types';

const include = { versions: { orderBy: { version: 'asc' as const } } };
type Record = Prisma.WarningRuleGetPayload<{ include: typeof include }>;

@Injectable()
export class PrismaWarningRuleRepository implements WarningRuleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: WarningRuleQuery) {
    const records = await this.prisma.warningRule.findMany({
      where: {
        source: query.source,
        publishStatus: query.publishStatus,
        enabled: query.enabled,
        OR: query.keyword
          ? [
              { code: { contains: query.keyword, mode: 'insensitive' } },
              { name: { contains: query.keyword, mode: 'insensitive' } },
              { scope: { contains: query.keyword, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include,
      orderBy: { code: 'asc' },
    });
    return records.map(mapRecord);
  }

  async findById(id: string) {
    const record = await this.prisma.warningRule.findUnique({ where: { id }, include });
    return record ? mapRecord(record) : undefined;
  }
  async findByCode(code: string) {
    const record = await this.prisma.warningRule.findUnique({ where: { code }, include });
    return record ? mapRecord(record) : undefined;
  }

  async create(rule: WarningRule) {
    try {
      const record = await this.prisma.warningRule.create({
        data: {
          id: rule.id,
          code: rule.code,
          ...configData(rule),
          enabled: rule.enabled,
          triggerCount: rule.triggerCount,
          lastTriggeredAt: rule.lastTriggeredAt ? new Date(rule.lastTriggeredAt) : undefined,
          publishStatus: rule.publishStatus,
          version: rule.version,
          revision: rule.revision,
          draft: rule.draft as unknown as Prisma.InputJsonValue,
          createdAt: new Date(rule.createdAt),
          updatedAt: new Date(rule.updatedAt),
        },
        include,
      });
      return mapRecord(record);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new WarningRuleCodeConflictError();
      throw error;
    }
  }

  async update(id: string, update: WarningRuleUpdate, expectedRevision: number) {
    const record = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.warningRule.updateMany({
        where: { id, revision: expectedRevision },
        data: {
          ...(update.publishedConfig ? configData(update.publishedConfig) : {}),
          draft:
            update.draft === null
              ? Prisma.DbNull
              : (update.draft as unknown as Prisma.InputJsonValue | undefined),
          publishStatus: update.publishStatus,
          enabled: update.enabled,
          workflowId: update.workflowId,
          version: update.newVersion?.version,
          revision: { increment: 1 },
          updatedAt: new Date(update.updatedAt),
        },
      });
      if (!updated.count) await this.throwConflict(transaction, id, expectedRevision);
      if (update.newVersion) {
        await transaction.warningRuleVersion.create({
          data: {
            id: update.newVersion.id,
            warningRuleId: id,
            version: update.newVersion.version,
            ...configData(update.newVersion),
            publishedAt: new Date(update.newVersion.publishedAt),
            publisherId: update.newVersion.publisherId,
            publisher: update.newVersion.publisher,
          },
        });
      }
      return transaction.warningRule.findUniqueOrThrow({ where: { id }, include });
    });
    return mapRecord(record);
  }

  private async throwConflict(
    transaction: Prisma.TransactionClient,
    id: string,
    expectedRevision: number,
  ): Promise<never> {
    const current = await transaction.warningRule.findUnique({
      where: { id },
      select: { revision: true },
    });
    if (!current) throw new WarningRuleNotFoundError();
    throw new WarningRuleRevisionConflictError(expectedRevision, current.revision);
  }
}

function configData(config: WarningRuleConfig) {
  return {
    name: config.name,
    source: config.source,
    scenario: config.scenario,
    level: config.level as PrismaRiskLevel,
    scope: config.scope,
    condition: config.condition,
    duration: config.duration,
    notifyTargets: config.notifyTargets,
    description: config.description,
    expression: config.expression as unknown as Prisma.InputJsonValue,
    rolloutPercentage: config.rolloutPercentage,
  };
}

function mapConfig(record: Record | Record['versions'][number]): WarningRuleConfig {
  return {
    name: record.name,
    source: record.source as WarningRuleConfig['source'],
    scenario: record.scenario as WarningRuleConfig['scenario'],
    level: record.level,
    scope: record.scope,
    condition: record.condition,
    duration: record.duration,
    notifyTargets: record.notifyTargets,
    description: record.description,
    expression: record.expression as unknown as WarningRuleExpressionItem[],
    rolloutPercentage: record.rolloutPercentage as 25 | 50 | 100,
  };
}

function mapRecord(record: Record): WarningRule {
  return {
    id: record.id,
    code: record.code,
    ...mapConfig(record),
    enabled: record.enabled,
    triggerCount: record.triggerCount,
    lastTriggeredAt: record.lastTriggeredAt?.toISOString(),
    publishStatus: record.publishStatus as WarningRule['publishStatus'],
    version: record.version,
    revision: record.revision,
    draft: record.draft ? (record.draft as unknown as WarningRuleConfig) : undefined,
    workflowId: record.workflowId ?? undefined,
    versions: record.versions.map((version) => ({
      id: version.id,
      ...mapConfig(version),
      version: version.version,
      publishedAt: version.publishedAt.toISOString(),
      publisherId: version.publisherId,
      publisher: version.publisher,
    })),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
