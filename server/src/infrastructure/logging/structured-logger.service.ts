import { Injectable } from '@nestjs/common';

export type LogLevel = 'info' | 'warn' | 'error';
export type LogFields = Record<string, string | number | boolean | undefined>;
export type LogSink = (line: string) => void;

@Injectable()
export class StructuredLoggerService {
  constructor(
    private readonly sink: LogSink = (line) => process.stdout.write(`${line}\n`),
    private readonly now: () => Date = () => new Date(),
  ) {}

  write(level: LogLevel, event: string, fields: LogFields = {}) {
    this.sink(JSON.stringify({ timestamp: this.now().toISOString(), level, event, ...fields }));
  }
}
