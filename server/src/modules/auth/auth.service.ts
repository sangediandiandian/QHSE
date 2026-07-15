import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { IamService } from '../iam/iam.service';
import type { AuthPrincipal } from '../iam/iam.types';

interface Session {
  principal: AuthPrincipal;
  expiresAt: number;
}

const demoPasswordHash = hashPassword('ant.design');

@Injectable()
export class AuthService {
  private readonly sessions = new Map<string, Session>();
  private readonly sessionTtlMs = 8 * 60 * 60 * 1000;

  constructor(private readonly iamService: IamService) {}

  login(username: string, password: string) {
    const user = this.iamService.findUserByUsername(username.trim());
    if (!user || user.status !== 'enabled' || !verifyPassword(password, demoPasswordHash)) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' });
    }

    const accessToken = randomBytes(32).toString('hex');
    const principal = this.iamService.createPrincipal(user);
    this.sessions.set(accessToken, {
      principal,
      expiresAt: Date.now() + this.sessionTtlMs,
    });
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.sessionTtlMs / 1000,
      user: principal,
    };
  }

  authenticate(accessToken: string) {
    const session = this.sessions.get(accessToken);
    if (!session || session.expiresAt <= Date.now()) {
      if (session) this.sessions.delete(accessToken);
      throw new UnauthorizedException({ code: 'SESSION_INVALID', message: '登录状态已失效，请重新登录' });
    }
    return structuredClone(session.principal);
  }

  logout(accessToken: string) {
    this.sessions.delete(accessToken);
  }
}

export function hashPassword(password: string) {
  return scryptSync(password, 'qhse-demo-auth-v1', 64).toString('hex');
}

function verifyPassword(password: string, expectedHash: string) {
  const actual = Buffer.from(hashPassword(password), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
