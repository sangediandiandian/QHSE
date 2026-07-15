import type { WarningEvaluationState, WarningSignal } from './warning-execution.types';

export const WARNING_EXECUTION_REPOSITORY = Symbol('WARNING_EXECUTION_REPOSITORY');

export interface WarningExecutionRepository {
  getState(ruleId: string, subjectId: string): Promise<WarningEvaluationState | undefined>;
  saveState(state: WarningEvaluationState): Promise<WarningEvaluationState>;
  findRecentActiveSignal(
    ruleId: string,
    subjectId: string,
    since: string,
  ): Promise<WarningSignal | undefined>;
  createSignal(signal: WarningSignal): Promise<WarningSignal>;
  listSignals(limit?: number): Promise<WarningSignal[]>;
}
