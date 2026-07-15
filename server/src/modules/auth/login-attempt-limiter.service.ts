import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface AttemptWindow {
  failures: number;
  startedAt: number;
  blockedUntil?: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

@Injectable()
export class LoginAttemptLimiterService {
  private readonly attempts = new Map<string, AttemptWindow>();

  assertAllowed(key: string, now = Date.now()) {
    const current = this.attempts.get(key);
    if (!current) return;
    if (current.blockedUntil && current.blockedUntil > now) {
      throw new HttpException(
        { code: 'LOGIN_RATE_LIMITED', message: '登录尝试过于频繁，请稍后再试' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (now - current.startedAt >= WINDOW_MS) this.attempts.delete(key);
  }

  recordFailure(key: string, now = Date.now()) {
    const previous = this.attempts.get(key);
    const current =
      !previous || now - previous.startedAt >= WINDOW_MS
        ? { failures: 0, startedAt: now }
        : previous;
    current.failures += 1;
    if (current.failures >= MAX_FAILURES) current.blockedUntil = now + WINDOW_MS;
    this.attempts.set(key, current);
  }

  clear(key: string) {
    this.attempts.delete(key);
  }
}
