import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EmergencyEventService } from '../emergency-events/emergency-event.service';
import type {
  EmergencyResponseLevel,
  EmergencySource,
} from '../emergency-events/emergency-event.types';
import type { WorkPermitService } from '../work-permits/work-permit.service';
import type { WarningRuleService } from '../warning-rules/warning-rule.service';
import type { WarningRule, WarningRuleExpressionItem } from '../warning-rules/warning-rule.types';
import type { EvaluateWarningSampleDto } from './dto/evaluate-warning-sample.dto';
import {
  type WarningExecutionRepository,
  WarningSignalNotFoundError,
  WarningSignalVersionConflictError,
} from './warning-execution.repository';
import type {
  MetricValue,
  WarningEvaluationState,
  WarningEvidenceCategory,
  WarningSignal,
} from './warning-execution.types';

interface WarningExecutionOptions {
  createId?: () => string;
  suppressionMs?: number;
  now?: () => Date;
}

export interface WarningSignalAccess {
  actorId: string;
  actorName: string;
  roleCodes?: string[];
  allowedAreaIds?: string[];
}

function toEmergencySource(source: WarningSignal['source']): EmergencySource {
  return ['GDS', 'VOC', 'MES', '联合预警', '作业许可'].includes(source)
    ? (source as EmergencySource)
    : '联合预警';
}

function toEmergencyResponseLevel(level: WarningSignal['level']): EmergencyResponseLevel {
  if (level === 'critical') return 'II级';
  if (level === 'high') return 'III级';
  return 'IV级';
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

function compare(
  actual: MetricValue | undefined,
  operator: WarningRuleExpressionItem['operator'],
  threshold: MetricValue,
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

function evaluateExpression(
  expression: WarningRuleExpressionItem[],
  metrics: Record<string, MetricValue>,
) {
  if (!expression.length) return false;
  return expression.reduce<boolean>((result, item, index) => {
    const current = compare(
      metrics[item.metric],
      item.operator,
      metrics[item.threshold] ?? item.threshold,
    );
    if (index === 0) return current;
    return item.connector === 'OR' ? result || current : result && current;
  }, false);
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

export class WarningExecutionService {
  private readonly createId: () => string;
  private readonly suppressionMs: number;
  private readonly now: () => Date;

  constructor(
    private readonly repository: WarningExecutionRepository,
    private readonly ruleService: WarningRuleService,
    private readonly workPermitService: WorkPermitService,
    options: WarningExecutionOptions = {},
    private readonly emergencyEventService?: EmergencyEventService,
  ) {
    this.createId = options.createId ?? randomUUID;
    this.suppressionMs = options.suppressionMs ?? 5 * 60 * 1000;
    this.now = options.now ?? (() => new Date());
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
      const ruleSample =
        rule.source === '联合预警' && sample.areaId
          ? {
              ...sample,
              source: '联合预警' as const,
              subjectId: `area:${sample.areaId}`,
            }
          : sample;
      if (!isInRollout(rule, ruleSample.subjectId)) continue;
      const state = await this.nextState(rule, ruleSample, occurredAt);
      await this.repository.saveState(state);
      if (!isRuleReady(rule, state, occurredAt)) continue;
      const since = new Date(new Date(occurredAt).getTime() - this.suppressionMs).toISOString();
      if (await this.repository.findRecentActiveSignal(rule.id, ruleSample.subjectId, since)) {
        suppressedRuleIds.push(rule.id);
        continue;
      }
      const signal = await this.repository.createSignal(
        this.createSignal(rule, ruleSample, occurredAt),
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

  async listSignals(limit?: number, allowedAreaIds?: string[]) {
    const signals = await this.repository.listSignals(limit, allowedAreaIds);
    return allowedAreaIds
      ? signals.filter((signal) => signal.areaId && allowedAreaIds.includes(signal.areaId))
      : signals;
  }

  async getSignal(id: string, allowedAreaIds?: string[]) {
    const signal = await this.repository.findSignalById(id, allowedAreaIds);
    if (!signal)
      throw new NotFoundException({ code: 'WARNING_SIGNAL_NOT_FOUND', message: '预警信号不存在' });
    return signal;
  }

  async acknowledge(id: string, expectedVersion: number, access: WarningSignalAccess) {
    const signal = await this.getSignal(id, access.allowedAreaIds);
    if (signal.status !== 'active') this.stateConflict(signal, '确认');
    return this.mutate(signal, 'acknowledged', expectedVersion, access, '确认', '预警信号已确认');
  }

  async verifyEvidence(
    id: string,
    expectedVersion: number,
    category: WarningEvidenceCategory,
    access: WarningSignalAccess,
  ) {
    const signal = await this.getSignal(id, access.allowedAreaIds);
    if (signal.status === 'closed') this.stateConflict(signal, '核验证据');
    if (signal.evidenceChecks.some((item) => item.category === category))
      throw new ConflictException({
        code: 'WARNING_EVIDENCE_ALREADY_VERIFIED',
        message: `${category}已经完成核验`,
      });
    return this.mutate(
      signal,
      undefined,
      expectedVersion,
      access,
      '证据核验',
      `${category}已完成一致性核验`,
      category,
    );
  }

  async startHandling(id: string, expectedVersion: number, access: WarningSignalAccess) {
    const signal = await this.getSignal(id, access.allowedAreaIds);
    if (signal.status !== 'acknowledged') this.stateConflict(signal, '开始处置');
    return this.mutate(signal, 'processing', expectedVersion, access, '开始处置', '预警处置已启动');
  }

  async startEmergencyResponse(id: string, expectedVersion: number, access: WarningSignalAccess) {
    const signal = await this.getSignal(id, access.allowedAreaIds);
    if (!this.emergencyEventService)
      throw new ConflictException({
        code: 'EMERGENCY_LINKAGE_UNAVAILABLE',
        message: '应急事件服务不可用',
      });
    const existing = await this.emergencyEventService.findByEventId(
      signal.id,
      access.allowedAreaIds,
    );
    if (signal.status === 'processing' && existing) return { signal, event: existing };
    if (signal.status !== 'acknowledged') this.stateConflict(signal, '启动应急响应');
    if (!signal.areaId)
      throw new ConflictException({
        code: 'WARNING_SIGNAL_AREA_REQUIRED',
        message: '预警信号未关联区域，不能启动应急响应',
      });
    const event =
      existing ??
      (await this.emergencyEventService.create(
        {
          eventId: signal.id,
          title: signal.title,
          areaId: signal.areaId,
          source: toEmergencySource(signal.source),
          responseLevel: toEmergencyResponseLevel(signal.level),
          summary: `${signal.detail}；已核验 ${signal.evidenceChecks.length} 类关联证据。`,
        },
        {
          actorId: access.actorId,
          actorName: access.actorName,
          roleCodes: access.roleCodes ?? [],
          allowedAreaIds: access.allowedAreaIds,
        },
      ));
    const updated = await this.mutate(
      signal,
      'processing',
      expectedVersion,
      access,
      '开始处置',
      `已生成应急事件 ${event.code}`,
    );
    return { signal: updated, event };
  }

  async close(id: string, expectedVersion: number, reason: string, access: WarningSignalAccess) {
    if (!reason.trim())
      throw new BadRequestException({
        code: 'WARNING_SIGNAL_CLOSE_REASON_REQUIRED',
        message: '关闭预警必须填写处置结论',
      });
    const signal = await this.getSignal(id, access.allowedAreaIds);
    if (!['acknowledged', 'processing'].includes(signal.status)) this.stateConflict(signal, '关闭');
    return this.mutate(signal, 'closed', expectedVersion, access, '关闭', reason.trim());
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
      operations: [],
      evidenceChecks: [],
      version: 1,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    };
  }

  private async mutate(
    signal: WarningSignal,
    status: WarningSignal['status'] | undefined,
    expectedVersion: number,
    access: WarningSignalAccess,
    action: '证据核验' | '确认' | '开始处置' | '关闭',
    detail: string,
    evidenceCategory?: WarningEvidenceCategory,
  ) {
    const timestamp = this.now().toISOString();
    try {
      return await this.repository.mutateSignal(
        signal.id,
        {
          status,
          operation: {
            id: this.createId(),
            action,
            operatorId: access.actorId,
            operator: access.actorName,
            operatedAt: timestamp,
            detail,
          },
          evidenceCheck: evidenceCategory
            ? {
                category: evidenceCategory,
                checkedById: access.actorId,
                checkedBy: access.actorName,
                checkedAt: timestamp,
              }
            : undefined,
          updatedAt: timestamp,
        },
        expectedVersion,
        access.allowedAreaIds,
      );
    } catch (error) {
      if (error instanceof WarningSignalNotFoundError)
        throw new NotFoundException({
          code: 'WARNING_SIGNAL_NOT_FOUND',
          message: '预警信号不存在',
        });
      if (error instanceof WarningSignalVersionConflictError)
        throw new ConflictException({
          code: 'VERSION_CONFLICT',
          message: '预警信号已被其他用户更新，请刷新后重试',
          details: {
            expectedVersion: error.expectedVersion,
            actualVersion: error.actualVersion,
          },
        });
      throw error;
    }
  }

  private stateConflict(signal: WarningSignal, action: string): never {
    throw new ConflictException({
      code: 'WARNING_SIGNAL_STATE_CONFLICT',
      message: `当前状态 ${signal.status} 不能${action}`,
    });
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
