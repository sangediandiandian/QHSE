import { ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { WorkflowActor } from '../workflows/workflow.service';
import { WorkflowService } from '../workflows/workflow.service';
import type { ReviewWarningRuleDto } from './dto/review-warning-rule.dto';
import type { RollbackWarningRuleDto } from './dto/rollback-warning-rule.dto';
import type { SaveWarningRuleDto } from './dto/save-warning-rule.dto';
import type { ToggleWarningRuleDto } from './dto/toggle-warning-rule.dto';
import type { WarningRuleRevisionDto } from './dto/revision.dto';
import {
  type WarningRuleRepository,
  WarningRuleCodeConflictError,
  WarningRuleNotFoundError,
  WarningRuleRevisionConflictError,
} from './warning-rule.repository';
import type {
  WarningRule,
  WarningRuleConfig,
  WarningRuleQuery,
  WarningRuleUpdate,
} from './warning-rule.types';

interface WarningRuleServiceOptions {
  now?: () => Date;
  createId?: () => string;
}

export class WarningRuleService {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(
    private readonly repository: WarningRuleRepository,
    private readonly workflowService: WorkflowService,
    options: WarningRuleServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  async list(query: WarningRuleQuery) {
    return Promise.all((await this.repository.findAll(query)).map((rule) => this.enrich(rule)));
  }

  async get(id: string) {
    const rule = await this.repository.findById(id);
    if (!rule) this.throwNotFound();
    return this.enrich(rule);
  }

  async createDraft(input: SaveWarningRuleDto, actor: WorkflowActor) {
    const config = toConfig(input);
    const timestamp = this.now().toISOString();
    const id = this.createId();
    const rule: WarningRule = {
      id,
      code: input.code.trim().toUpperCase(),
      ...config,
      enabled: false,
      triggerCount: 0,
      publishStatus: '草稿',
      version: 0,
      revision: 1,
      draft: config,
      versions: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    try {
      return await this.repository.create(rule);
    } catch (error) {
      this.mapError(error);
    }
  }

  async saveDraft(id: string, input: SaveWarningRuleDto) {
    const rule = await this.requireRule(id);
    if (rule.publishStatus === '待审批') this.throwState('待审批规则不能编辑，请先驳回或完成审批');
    if (input.code.trim().toUpperCase() !== rule.code) {
      throw new ConflictException({
        code: 'WARNING_RULE_CODE_IMMUTABLE',
        message: '规则编码创建后不能修改',
      });
    }
    return this.update(
      rule,
      { draft: toConfig(input), publishStatus: '草稿', updatedAt: this.now().toISOString() },
      input.expectedRevision,
    );
  }

  async submit(id: string, input: WarningRuleRevisionDto, actor: WorkflowActor) {
    const rule = await this.requireRule(id);
    if (rule.publishStatus !== '草稿' || !rule.draft) this.throwState('只有完整草稿可以提交会签');
    const conflicts = await this.findConflicts(rule.id, rule.draft);
    if (conflicts.length) {
      throw new ConflictException({
        code: 'WARNING_RULE_CONFLICT',
        message: '存在作用范围和表达式重复的启用规则',
        details: { conflicts: conflicts.map((item) => item.code) },
      });
    }
    const workflow = await this.workflowService.create(
      {
        businessType: 'warning_rule',
        businessId: rule.id,
        title: `${rule.code} 预警规则发布会签`,
        steps: [
          { name: 'QHSE 会签', allowedRoleCodes: ['qhse_manager'] },
          { name: '生产负责人会签', allowedRoleCodes: ['production_dispatcher'] },
        ],
      },
      actor,
    );
    return this.enrich(
      await this.update(
        rule,
        { publishStatus: '待审批', workflowId: workflow.id, updatedAt: this.now().toISOString() },
        input.expectedRevision,
      ),
    );
  }

  async approve(id: string, input: ReviewWarningRuleDto, actor: WorkflowActor) {
    const rule = await this.requirePending(id);
    const workflow = await this.workflowService.get(rule.workflowId!);
    const reviewed = await this.workflowService.approve(
      workflow.id,
      input.opinion ?? '',
      workflow.version,
      actor,
    );
    if (reviewed.status !== '已通过') {
      return this.enrich(
        await this.update(rule, { updatedAt: this.now().toISOString() }, input.expectedRevision),
      );
    }
    const timestamp = this.now().toISOString();
    const config = rule.draft!;
    const version = rule.version + 1;
    return this.update(
      rule,
      {
        publishedConfig: config,
        draft: null,
        publishStatus: '已发布',
        enabled: rule.version === 0 ? true : rule.enabled,
        workflowId: null,
        newVersion: {
          id: this.createId(),
          ...config,
          version,
          publishedAt: timestamp,
          publisherId: actor.actorId,
          publisher: actor.actorName,
        },
        updatedAt: timestamp,
      },
      input.expectedRevision,
    );
  }

  async reject(id: string, input: ReviewWarningRuleDto, actor: WorkflowActor) {
    const rule = await this.requirePending(id);
    const workflow = await this.workflowService.get(rule.workflowId!);
    await this.workflowService.reject(workflow.id, input.opinion ?? '', workflow.version, actor);
    return this.update(
      rule,
      { publishStatus: '草稿', workflowId: null, updatedAt: this.now().toISOString() },
      input.expectedRevision,
    );
  }

  async rollback(id: string, input: RollbackWarningRuleDto) {
    const rule = await this.requireRule(id);
    if (rule.publishStatus === '待审批') this.throwState('待审批规则不能回滚');
    const target = rule.versions.find((item) => item.version === input.version);
    if (!target)
      throw new NotFoundException({
        code: 'WARNING_RULE_VERSION_NOT_FOUND',
        message: '规则版本不存在',
      });
    return this.update(
      rule,
      { draft: toConfig(target), publishStatus: '草稿', updatedAt: this.now().toISOString() },
      input.expectedRevision,
    );
  }

  async toggle(id: string, input: ToggleWarningRuleDto) {
    const rule = await this.requireRule(id);
    if (!rule.version || rule.publishStatus !== '已发布') this.throwState('只有已发布规则可以启停');
    if (rule.enabled === input.enabled) return this.enrich(rule);
    return this.update(
      rule,
      { enabled: input.enabled, updatedAt: this.now().toISOString() },
      input.expectedRevision,
    );
  }

  async recordTrigger(id: string, triggeredAt: string) {
    try {
      return await this.repository.recordTrigger(id, triggeredAt);
    } catch (error) {
      this.mapError(error);
    }
  }

  private async findConflicts(ruleId: string, candidate: WarningRuleConfig) {
    const signature = configSignature(candidate);
    return (await this.repository.findAll({ enabled: true })).filter(
      (rule) =>
        rule.id !== ruleId &&
        rule.publishStatus === '已发布' &&
        rule.source === candidate.source &&
        rule.scope === candidate.scope &&
        configSignature(rule) === signature,
    );
  }

  private async requireRule(id: string) {
    const rule = await this.repository.findById(id);
    if (!rule) this.throwNotFound();
    return rule;
  }

  private async requirePending(id: string) {
    const rule = await this.requireRule(id);
    if (rule.publishStatus !== '待审批' || !rule.workflowId || !rule.draft)
      this.throwState('规则不在会签状态');
    return rule;
  }

  private async enrich(rule: WarningRule): Promise<WarningRule> {
    if (!rule.workflowId) return rule;
    const workflow = await this.workflowService.get(rule.workflowId);
    return {
      ...rule,
      approvalSteps: workflow.steps.map((step) => ({
        role: step.name as 'QHSE 会签' | '生产负责人会签',
        approver: step.actorName ?? step.allowedRoleCodes.join('/'),
        status: step.status,
        approvedAt: step.actedAt,
      })),
    };
  }

  private async update(rule: WarningRule, update: WarningRuleUpdate, expectedRevision?: number) {
    try {
      return await this.repository.update(rule.id, update, expectedRevision ?? rule.revision);
    } catch (error) {
      this.mapError(error);
    }
  }

  private mapError(error: unknown): never {
    if (error instanceof WarningRuleNotFoundError) this.throwNotFound();
    if (error instanceof WarningRuleCodeConflictError)
      throw new ConflictException({
        code: 'WARNING_RULE_CODE_CONFLICT',
        message: '规则编码已存在',
      });
    if (error instanceof WarningRuleRevisionConflictError)
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: '预警规则已被其他用户更新，请刷新后重试',
        details: { expectedRevision: error.expectedRevision, actualRevision: error.actualRevision },
      });
    throw error;
  }

  private throwNotFound(): never {
    throw new NotFoundException({ code: 'WARNING_RULE_NOT_FOUND', message: '预警规则不存在' });
  }
  private throwState(message: string): never {
    throw new ConflictException({ code: 'WARNING_RULE_STATE_CONFLICT', message });
  }
}

function toConfig(input: WarningRuleConfig): WarningRuleConfig {
  return {
    name: input.name.trim(),
    source: input.source,
    scenario: input.scenario,
    level: input.level,
    scope: input.scope.trim(),
    condition: input.condition.trim(),
    duration: input.duration.trim(),
    notifyTargets: input.notifyTargets.map((item) => item.trim()).filter(Boolean),
    description: input.description.trim(),
    expression: input.expression.map((item) => ({
      ...item,
      metric: item.metric.trim(),
      threshold: item.threshold.trim(),
    })),
    rolloutPercentage: input.rolloutPercentage,
  };
}

function configSignature(config: WarningRuleConfig) {
  return (
    config.expression
      .map((item) => `${item.metric}${item.operator}${item.threshold}${item.connector}`)
      .join('|') || config.condition.trim()
  );
}
