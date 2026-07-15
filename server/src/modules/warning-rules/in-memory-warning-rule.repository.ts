import { warningRuleSeed } from './warning-rule.seed';
import {
  type WarningRuleRepository,
  WarningRuleCodeConflictError,
  WarningRuleNotFoundError,
  WarningRuleRevisionConflictError,
} from './warning-rule.repository';
import type { WarningRule, WarningRuleQuery, WarningRuleUpdate } from './warning-rule.types';

const clone = <T>(value: T): T => structuredClone(value);

export class InMemoryWarningRuleRepository implements WarningRuleRepository {
  private readonly records = new Map(warningRuleSeed.map((item) => [item.id, clone(item)]));

  async findAll(query: WarningRuleQuery) {
    const keyword = query.keyword?.trim().toLocaleLowerCase();
    return [...this.records.values()]
      .filter((item) => !query.source || item.source === query.source)
      .filter((item) => !query.publishStatus || item.publishStatus === query.publishStatus)
      .filter((item) => query.enabled === undefined || item.enabled === query.enabled)
      .filter(
        (item) =>
          !keyword ||
          [item.code, item.name, item.scope].some((value) =>
            value.toLocaleLowerCase().includes(keyword),
          ),
      )
      .map(clone);
  }

  async findById(id: string) {
    const item = this.records.get(id);
    return item ? clone(item) : undefined;
  }
  async findByCode(code: string) {
    const item = [...this.records.values()].find((rule) => rule.code === code);
    return item ? clone(item) : undefined;
  }

  async create(rule: WarningRule) {
    if ([...this.records.values()].some((item) => item.code === rule.code))
      throw new WarningRuleCodeConflictError();
    this.records.set(rule.id, clone(rule));
    return clone(rule);
  }

  async update(id: string, update: WarningRuleUpdate, expectedRevision: number) {
    const item = this.records.get(id);
    if (!item) throw new WarningRuleNotFoundError();
    if (item.revision !== expectedRevision)
      throw new WarningRuleRevisionConflictError(expectedRevision, item.revision);
    const next: WarningRule = {
      ...item,
      ...(update.publishedConfig ?? {}),
      draft: update.draft === null ? undefined : (update.draft ?? item.draft),
      publishStatus: update.publishStatus ?? item.publishStatus,
      enabled: update.enabled ?? item.enabled,
      workflowId: update.workflowId === null ? undefined : (update.workflowId ?? item.workflowId),
      version: update.newVersion?.version ?? item.version,
      versions: update.newVersion ? [...item.versions, update.newVersion] : item.versions,
      revision: item.revision + 1,
      updatedAt: update.updatedAt,
    };
    this.records.set(id, clone(next));
    return clone(next);
  }

  async recordTrigger(id: string, triggeredAt: string) {
    const item = this.records.get(id);
    if (!item) throw new WarningRuleNotFoundError();
    const next = { ...item, triggerCount: item.triggerCount + 1, lastTriggeredAt: triggeredAt };
    this.records.set(id, clone(next));
    return clone(next);
  }
}
