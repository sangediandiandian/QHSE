import { randomUUID } from 'node:crypto';
import type { WorkPermitService } from '../work-permits/work-permit.service';
import type { WarningRuleService } from '../warning-rules/warning-rule.service';
import type { WarningRule, WarningRuleExpressionItem } from '../warning-rules/warning-rule.types';
import type { EvaluateWarningSampleDto } from './dto/evaluate-warning-sample.dto';
import type { WarningExecutionRepository } from './warning-execution.repository';
import type { MetricValue, WarningEvaluationState, WarningSignal } from './warning-execution.types';

interface WarningExecutionOptions {
  createId?: () => string;
  suppressionMs?: number;
}

export class WarningExecutionService {
  private readonly createId: () => string;
  private readonly suppressionMs: number;

  constructor(
    private readonly repository: WarningExecutionRepository,
    private readonly ruleService: WarningRuleService,
    private readonly workPermitService: WorkPermitService,
    options: WarningExecutionOptions = {},
  ) {
    this.createId = options.createId ?? randomUUID;
    this.suppressionMs = options.suppressionMs ?? 5 * 60 * 1000;
  }

  async evaluate(sample: EvaluateWarningSampleDto) {
    const occurredAt = new Date(sample.occurredAt).toISOString();
    const rules = (await this.ruleService.list({ enabled: true })).filter(
      (rule) =>
        rule.publishStatus === '已发布' &&
        (rule.source === sample.source || rule.source === '联合预警'),
    );
    const triggeredSignals: WarningSignal[] = [];
    const suppressedRuleIds: string[] = [];

    for (const rule of rules) {
      if (!isInRollout(rule, sample.subjectId)) continue;
      const state = await this.nextState(rule, sample, occurredAt);
      await this.repository.saveState(state);
      if (!isRuleReady(rule, state, occurredAt)) continue;
      const since = new Date(new Date(occurredAt).getTime() - this.suppressionMs).toISOString();
      if (await this.repository.findRecentActiveSignal(rule.id, sample.subjectId, since)) {
        suppressedRuleIds.push(rule.id);
        continue;
      }
      const signal = await this.repository.createSignal(
        this.createSignal(rule, sample, occurredAt),
      );
      await this.ruleService.recordTrigger(rule.id, occurredAt);
      triggeredSignals.push(signal);
    }

    const linkedPermitIds = await this.linkWorkPermits(triggeredSignals, sample.areaId);
    return {
      evaluatedRuleCount: rules.length,
      triggeredSignals,
      suppressedRuleIds,
      linkedPermitIds,
    };
  }

  listSignals(limit?: number) {
    return this.repository.listSignals(limit);
  }

  private async nextState(rule: WarningRule, sample: EvaluateWarningSampleDto, occurredAt: string) {
    const current = await this.repository.getState(rule.id, sample.subjectId);
    const latestMetrics = { ...(current?.latestMetrics ?? {}), ...sample.metrics };
    const metricTimes = { ...(current?.metricTimes ?? {}) };
    for (const key of Object.keys(sample.metrics)) metricTimes[key] = occurredAt;
    const matched = evaluateExpression(rule.expression, latestMetrics);
    const timestamp = occurredAt;
    return {
      id: current?.id ?? this.createId(),
      ruleId: rule.id,
      subjectId: sample.subjectId,
      latestMetrics,
      metricTimes,
      conditionSince: matched ? (current?.conditionSince ?? timestamp) : undefined,
      lastEvaluatedAt: timestamp,
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: timestamp,
    } satisfies WarningEvaluationState;
  }

  private createSignal(
    rule: WarningRule,
    sample: EvaluateWarningSampleDto,
    occurredAt: string,
  ): WarningSignal {
    const id = this.createId();
    return {
      id,
      code: `WARN-${occurredAt.replace(/[-:TZ.]/g, '').slice(0, 14)}-${id.slice(0, 6).toUpperCase()}`,
      ruleId: rule.id,
      ruleCode: rule.code,
      subjectId: sample.subjectId,
      areaId: sample.areaId,
      source: sample.source,
      level: rule.level,
      title: rule.name,
      detail: `${rule.condition}；采样对象 ${sample.subjectId}`,
      occurredAt,
      status: 'active',
      createdAt: occurredAt,
    };
  }

  private async linkWorkPermits(signals: WarningSignal[], areaId?: string) {
    if (!areaId || !signals.some((signal) => ['high', 'critical'].includes(signal.level)))
      return [];
    const linkageEnabled = (
      await this.ruleService.list({ source: '作业许可', enabled: true })
    ).some((rule) => rule.publishStatus === '已发布' && rule.scenario === 'permit-linkage');
    if (!linkageEnabled) return [];
    const permits = await this.workPermitService.list({ areaId, status: '作业中' });
    const linked: string[] = [];
    for (const permit of permits) {
      await this.workPermitService.recommendPause(
        permit.id,
        {
          reason: `预警规则命中：${signals
            .filter((signal) => ['high', 'critical'].includes(signal.level))
            .map((signal) => signal.ruleCode)
            .join('、')}`,
          expectedVersion: permit.version,
        },
        {
          actorId: 'system-warning-engine',
          actorName: '预警规则执行器',
          roleCodes: ['system_admin'],
        },
      );
      linked.push(permit.id);
    }
    return linked;
  }
}

function evaluateExpression(
  expression: WarningRuleExpressionItem[],
  metrics: Record<string, MetricValue>,
) {
  if (!expression.length) return false;
  return expression.reduce<boolean>((result, item, index) => {
    const current = compare(metrics[item.metric], item.operator, item.threshold);
    if (index === 0) return current;
    return item.connector === 'OR' ? result || current : result && current;
  }, false);
}

function compare(
  actual: MetricValue | undefined,
  operator: WarningRuleExpressionItem['operator'],
  threshold: string,
) {
  if (actual === undefined) return false;
  const left = comparable(actual);
  const right = comparable(threshold);
  if (operator === '=') return left === right;
  if (operator === '>') return left > right;
  if (operator === '>=') return left >= right;
  if (operator === '<') return left < right;
  return left <= right;
}

function comparable(value: MetricValue) {
  const ranks: Record<string, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
    一般: 2,
    较大: 3,
    重大: 4,
  };
  if (String(value) in ranks) return ranks[String(value)];
  const numeric = Number(value);
  return Number.isNaN(numeric) ? String(value) : numeric;
}

function isRuleReady(rule: WarningRule, state: WarningEvaluationState, occurredAt: string) {
  if (!state.conditionSince) return false;
  const minutes = Number(rule.duration.match(/(\d+)\s*分钟/)?.[1] ?? 0);
  if (rule.duration.includes('时间窗口')) {
    const times = rule.expression
      .map((item) => state.metricTimes[item.metric])
      .filter(Boolean)
      .map(Date.parse);
    return (
      times.length === rule.expression.length &&
      Math.max(...times) - Math.min(...times) <= minutes * 60_000
    );
  }
  return (
    new Date(occurredAt).getTime() - new Date(state.conditionSince).getTime() >= minutes * 60_000
  );
}

function isInRollout(rule: WarningRule, subjectId: string) {
  let hash = 0;
  for (const character of `${rule.id}:${subjectId}`)
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 100 < (rule.rolloutPercentage ?? 100);
}
