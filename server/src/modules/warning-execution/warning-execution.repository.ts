import type {
  WarningEvaluationState,
  WarningSignal,
  WarningSignalMutation,
} from './warning-execution.types';

export const WARNING_EXECUTION_REPOSITORY = Symbol('WARNING_EXECUTION_REPOSITORY');
export class WarningSignalNotFoundError extends Error {}
export class WarningSignalVersionConflictError extends Error {
  constructor(
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
  ) {
    super('Warning signal version conflict');
  }
}

export interface WarningExecutionRepository {
  getState(ruleId: string, subjectId: string): Promise<WarningEvaluationState | undefined>;
  saveState(state: WarningEvaluationState): Promise<WarningEvaluationState>;
  findRecentActiveSignal(
    ruleId: string,
    subjectId: string,
    since: string,
  ): Promise<WarningSignal | undefined>;
  createSignal(signal: WarningSignal): Promise<WarningSignal>;
  listSignals(limit?: number, allowedAreaIds?: string[]): Promise<WarningSignal[]>;
  findSignalById(id: string, allowedAreaIds?: string[]): Promise<WarningSignal | undefined>;
  mutateSignal(
    id: string,
    mutation: WarningSignalMutation,
    expectedVersion: number,
    allowedAreaIds?: string[],
  ): Promise<WarningSignal>;
}
