import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { HazardService } from './hazard.service';

@Injectable()
export class HazardReminderScheduler implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(HazardReminderScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly hazards: HazardService) {}

  onModuleInit() {
    if (process.env.QHSE_HAZARD_REMINDERS_ENABLED !== 'true') return;
    const configured = Number(process.env.QHSE_HAZARD_REMINDER_INTERVAL_MS);
    const intervalMs = Number.isFinite(configured) && configured >= 60_000 ? configured : 900_000;
    void this.run();
    this.timer = setInterval(() => void this.run(), intervalMs);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private async run() {
    try {
      const result = await this.hazards.runReminders();
      if (result.created || result.failed) {
        this.logger.log(
          `Hazard reminder scan created=${result.created} skipped=${result.skipped} failed=${result.failed}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Hazard reminder scan failed: ${error instanceof Error ? error.name : 'UnknownError'}`,
      );
    }
  }
}
