import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { TelemetryIngestOutcome, TelemetryStreamEvent } from './telemetry.types';

type Listener = (event: TelemetryStreamEvent) => void;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const replayCapacity = () => {
  const configured = Number(process.env.QHSE_TELEMETRY_REPLAY_SIZE || 1000);
  return Number.isFinite(configured) ? Math.max(100, Math.floor(configured)) : 1000;
};

@Injectable()
export class TelemetryStreamService {
  private readonly id = randomUUID();
  private sequence = 0;
  private readonly events: TelemetryStreamEvent[] = [];
  private readonly listeners = new Set<Listener>();
  private readonly capacity = replayCapacity();

  publish(outcome: TelemetryIngestOutcome) {
    const event: TelemetryStreamEvent = {
      streamId: this.id,
      sequence: ++this.sequence,
      emittedAt: new Date().toISOString(),
      point: outcome.point,
      sample: outcome.sample,
      outOfOrder: outcome.outOfOrder,
      clockDriftMs: outcome.clockDriftMs,
    };
    this.events.push(clone(event));
    if (this.events.length > this.capacity)
      this.events.splice(0, this.events.length - this.capacity);
    this.listeners.forEach((listener) => listener(clone(event)));
    return event;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  replay(afterSequence: number, predicate: (event: TelemetryStreamEvent) => boolean) {
    return this.events
      .filter((event) => event.sequence > afterSequence && predicate(event))
      .map((event) => clone(event));
  }

  latestSequence() {
    return this.sequence;
  }

  streamId() {
    return this.id;
  }

  earliestSequence() {
    return this.events[0]?.sequence ?? this.sequence;
  }
}
