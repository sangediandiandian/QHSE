import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { IamService } from '../iam/iam.service';
import { LoginAttemptLimiterService } from './login-attempt-limiter.service';
import { SessionStoreService } from '../../infrastructure/session/session-store.service';
import { MemorySessionStore } from '../../infrastructure/session/memory-session.store';
import { verifyPassword } from './password';

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
    if (!user || user.status !== 'enabled' || !verifyPassword(password, user.passwordHash)) {
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
        {
          principal,
          credentialVersion: this.credentialVersion(user.passwordHash),
          expiresAt: now + this.sessionTtlMs,
          createdAt: now,
        },
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
      passwordChangeRequired: principal.passwordChangeRequired,
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = this.iamService.findUserById(userId);
    if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
      throw new BadRequestException({
        code: 'CURRENT_PASSWORD_INVALID',
        message: '当前密码不正确',
      });
    }
    if (verifyPassword(newPassword, user.passwordHash)) {
      throw new BadRequestException({
        code: 'PASSWORD_UNCHANGED',
        message: '新密码不能与当前密码相同',
      });
    }
    await this.iamService.updatePassword(userId, newPassword, false);
    await this.sessions.deleteUser(userId).catch(() => undefined);
    return { passwordChanged: true, reauthenticationRequired: true };
  }

  async resetPassword(userId: string, temporaryPassword: string) {
    if (!this.iamService.findUserById(userId)) {
      throw new NotFoundException({ code: 'IAM_USER_NOT_FOUND', message: '用户不存在' });
    }
    const user = await this.iamService.updatePassword(userId, temporaryPassword, true);
    await this.sessions.deleteUser(userId).catch(() => undefined);
    return { passwordReset: true, passwordChangeRequired: true, user };
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
    if (
      !user ||
      user.status !== 'enabled' ||
      session.credentialVersion !== this.credentialVersion(user.passwordHash)
    ) {
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

  private credentialVersion(passwordHash: string) {
    return createHash('sha256').update(passwordHash).digest('hex');
  }
}
