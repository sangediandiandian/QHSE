import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { IamService } from '../iam/iam.service';
import { LoginAttemptLimiterService } from './login-attempt-limiter.service';
import { SessionStoreService } from '../../infrastructure/session/session-store.service';
import { MemorySessionStore } from '../../infrastructure/session/memory-session.store';

export function hashPassword(password: string) {
  return scryptSync(password, 'qhse-demo-auth-v1', 64).toString('hex');
}

function verifyPassword(password: string, expectedHash: string) {
  const actual = Buffer.from(hashPassword(password), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const demoPasswordHash = hashPassword('ant.design');

@Injectable()
export class AuthService {
  private readonly sessionTtlMs = 8 * 60 * 60 * 1000;

  constructor(
    private readonly iamService: IamService,
    private readonly loginLimiter: LoginAttemptLimiterService = new LoginAttemptLimiterService(),
    private readonly sessions: SessionStoreService = new SessionStoreService(
      new MemorySessionStore(),
    ),
  ) {}

  async login(username: string, password: string, clientKey = 'local') {
    const normalizedUsername = username.trim();
    const attemptKey = `${clientKey}:${normalizedUsername.toLowerCase()}`;
    this.loginLimiter.assertAllowed(attemptKey);
    const user = this.iamService.findUserByUsername(normalizedUsername);
    if (!user || user.status !== 'enabled' || !verifyPassword(password, demoPasswordHash)) {
      this.loginLimiter.recordFailure(attemptKey);
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' });
    }

    this.loginLimiter.clear(attemptKey);
    const now = Date.now();
    const accessToken = randomBytes(32).toString('hex');
    const principal = this.iamService.createPrincipal(user);
    try {
      await this.sessions.create(
        accessToken,
        { principal, expiresAt: now + this.sessionTtlMs, createdAt: now },
        this.sessionTtlMs,
        5,
      );
    } catch {
      throw this.sessionUnavailable();
    }
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.sessionTtlMs / 1000,
      user: principal,
    };
  }

  async authenticate(accessToken: string) {
    let session;
    try {
      session = await this.sessions.get(accessToken);
    } catch {
      throw this.sessionUnavailable();
    }
    if (!session || session.expiresAt <= Date.now()) {
      if (session) await this.sessions.delete(accessToken).catch(() => undefined);
      throw new UnauthorizedException({
        code: 'SESSION_INVALID',
        message: '登录状态已失效，请重新登录',
      });
    }
    const user = this.iamService.findUserById(session.principal.userId);
    if (!user || user.status !== 'enabled') {
      await this.sessions.delete(accessToken).catch(() => undefined);
      throw new UnauthorizedException({
        code: 'SESSION_INVALID',
        message: '登录状态已失效，请重新登录',
      });
    }
    return this.iamService.createPrincipal(user);
  }

  async logout(accessToken: string) {
    try {
      await this.sessions.delete(accessToken);
    } catch {
      throw this.sessionUnavailable();
    }
  }

  private sessionUnavailable() {
    return new ServiceUnavailableException({
      code: 'SESSION_STORE_UNAVAILABLE',
      message: '登录服务暂不可用，请稍后重试',
    });
  }
}
