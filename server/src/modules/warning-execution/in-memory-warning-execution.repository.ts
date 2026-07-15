import type { WarningExecutionRepository } from './warning-execution.repository';
import type { WarningEvaluationState, WarningSignal } from './warning-execution.types';

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
        signal.status === 'active' &&
        signal.occurredAt >= since,
    );
    return item ? clone(item) : undefined;
  }

  async createSignal(signal: WarningSignal) {
    this.signals.set(signal.id, clone(signal));
    return clone(signal);
  }

  async listSignals(limit = 100) {
    return [...this.signals.values()]
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, limit)
      .map(clone);
  }
}
