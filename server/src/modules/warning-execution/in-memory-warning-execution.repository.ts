import {
  type WarningExecutionRepository,
  WarningSignalNotFoundError,
  WarningSignalVersionConflictError,
} from './warning-execution.repository';
import type {
  WarningEvaluationState,
  WarningSignal,
  WarningSignalMutation,
} from './warning-execution.types';

const clone = <T>(value: T): T => structuredClone(value);

export class InMemoryWarningExecutionRepository implements WarningExecutionRepository {
  private readonly states = new Map<string, WarningEvaluationState>();
  private readonly signals = new Map<string, WarningSignal>();

  async getState(ruleId: string, subjectId: string) {
    const item = this.states.get(`${ruleId}:${subjectId}`);
    return item ? clone(item) : undefined;
  }

  async saveState(state: WarningEvaluationState) {
    this.states.set(`${state.ruleId}:${state.subjectId}`, clone(state));
    return clone(state);
  }

  async findRecentActiveSignal(ruleId: string, subjectId: string, since: string) {
    const item = [...this.signals.values()].find(
      (signal) =>
        signal.ruleId === ruleId &&
        signal.subjectId === subjectId &&
        signal.status !== 'closed' &&
        signal.occurredAt >= since,
    );
    return item ? clone(item) : undefined;
  }

  async createSignal(signal: WarningSignal) {
    this.signals.set(signal.id, clone(signal));
    return clone(signal);
  }

  async listSignals(limit = 100, allowedAreaIds?: string[]) {
    return [...this.signals.values()]
      .filter(
        (signal) => !allowedAreaIds || (signal.areaId && allowedAreaIds.includes(signal.areaId)),
      )
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, limit)
      .map(clone);
  }

  async findSignalById(id: string, allowedAreaIds?: string[]) {
    const signal = this.signals.get(id);
    if (!signal || (allowedAreaIds && (!signal.areaId || !allowedAreaIds.includes(signal.areaId))))
      return undefined;
    return clone(signal);
  }

  async mutateSignal(
    id: string,
    mutation: WarningSignalMutation,
    expectedVersion: number,
    allowedAreaIds?: string[],
  ) {
    const signal = await this.findSignalById(id, allowedAreaIds);
    if (!signal) throw new WarningSignalNotFoundError();
    if (signal.version !== expectedVersion)
      throw new WarningSignalVersionConflictError(expectedVersion, signal.version);
    const next: WarningSignal = {
      ...signal,
      ...mutation,
      operations: [...signal.operations, mutation.operation],
      version: signal.version + 1,
    };
    this.signals.set(id, clone(next));
    return clone(next);
  }
}
