import type { WarningRule, WarningRuleQuery, WarningRuleUpdate } from './warning-rule.types';

export const WARNING_RULE_REPOSITORY = Symbol('WARNING_RULE_REPOSITORY');
export class WarningRuleNotFoundError extends Error {}
export class WarningRuleCodeConflictError extends Error {}
export class WarningRuleRevisionConflictError extends Error {
  constructor(
    public readonly expectedRevision: number,
    public readonly actualRevision: number,
  ) {
    super('Warning rule revision conflict');
  }
}

export interface WarningRuleRepository {
  findAll(query: WarningRuleQuery): Promise<WarningRule[]>;
  findById(id: string): Promise<WarningRule | undefined>;
  findByCode(code: string): Promise<WarningRule | undefined>;
  create(rule: WarningRule): Promise<WarningRule>;
  update(id: string, update: WarningRuleUpdate, expectedRevision: number): Promise<WarningRule>;
}
