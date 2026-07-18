/** @jest-environment node */

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { IamService } from '../../iam/iam.service';
import { AuthService } from '../auth.service';
import { OidcFlowStoreService } from './oidc-flow-store.service';
import { MemoryOidcFlowStore } from './oidc-flow.store';
import {
  type OidcProtocol,
  OidcService,
  type OidcSettings,
  oidcSettingsFromEnvironment,
} from './oidc.service';

const settings: OidcSettings = {
  enabled: true,
  issuer: 'https://identity.example.com',
  clientId: 'qhse',
  clientSecret: 'secret',
  redirectUri: 'https://qhse.example.com/api/v1/auth/oidc/callback',
  webLoginUrl: 'https://qhse.example.com/user/login',
  label: '企业统一认证',
  usernameClaim: 'preferred_username',
  localLoginEnabled: false,
};

class TestOidcProtocol implements OidcProtocol {
  transaction?: { state: string; nonce: string; codeVerifier: string };
  claims: Record<string, unknown> = {
    sub: 'identity-operator',
    preferred_username: 'operator',
  };

  async discover() {
    return { discovered: true };
  }

  async createAuthorization() {
    return {
      url: 'https://identity.example.com/authorize?state=state-1',
      state: 'state-1',
      nonce: 'nonce-1',
      codeVerifier: 'verifier-1',
    };
  }

  async exchange(
    _configuration: unknown,
    _currentUrl: URL,
    transaction: { state: string; nonce: string; codeVerifier: string },
  ) {
    this.transaction = transaction;
    return this.claims;
  }
}

describe('OidcService', () => {
  test('PKCE 流程映射现有账号并通过一次性结果签发 QHSE 会话', async () => {
    const auth = new AuthService(new IamService());
    const protocol = new TestOidcProtocol();
    const service = new OidcService(
      auth,
      new OidcFlowStoreService(new MemoryOidcFlowStore(() => 1_000)),
      settings,
      protocol,
      () => 1_000,
    );
    await service.onModuleInit();
    const flow = await service.begin();
    expect(flow.authorizationUrl).toContain('identity.example.com/authorize');

    const completion = await service.complete(
      new URL(`${settings.redirectUri}?code=code-1&state=state-1`),
      flow.transactionId,
    );
    expect(protocol.transaction).toEqual({
      state: 'state-1',
      nonce: 'nonce-1',
      codeVerifier: 'verifier-1',
      createdAt: 1_000,
    });
    expect(completion.username).toBe('operator');
    const result = await service.exchangeCompletion(completion.completionCode);
    expect(result).toMatchObject({
      status: 'ok',
      passwordChangeRequired: false,
      accessToken: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    await expect(auth.authenticate(result.accessToken)).resolves.toMatchObject({
      username: 'operator',
      passwordChangeRequired: false,
    });
    await expect(service.exchangeCompletion(completion.completionCode)).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.complete(
        new URL(`${settings.redirectUri}?code=code-1&state=state-1`),
        flow.transactionId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  test('拒绝缺少映射声明或未映射到本地启用账号的身份', async () => {
    const protocol = new TestOidcProtocol();
    protocol.claims = { sub: 'unknown' };
    const service = new OidcService(
      new AuthService(new IamService()),
      new OidcFlowStoreService(new MemoryOidcFlowStore()),
      settings,
      protocol,
    );
    await service.onModuleInit();
    let flow = await service.begin();
    await expect(
      service.complete(new URL(`${settings.redirectUri}?code=code-1`), flow.transactionId),
    ).rejects.toThrow(UnauthorizedException);

    protocol.claims = { sub: 'unknown', preferred_username: 'missing-user' };
    flow = await service.begin();
    await expect(
      service.complete(new URL(`${settings.redirectUri}?code=code-2`), flow.transactionId),
    ).rejects.toThrow(UnauthorizedException);
  });

  test('配置校验阻止无 OIDC 时关闭本地登录和生产 HTTP 回调', () => {
    expect(() =>
      oidcSettingsFromEnvironment({
        QHSE_LOCAL_LOGIN_ENABLED: 'false',
      }),
    ).toThrow('Local login cannot be disabled');

    expect(() =>
      oidcSettingsFromEnvironment({
        NODE_ENV: 'production',
        QHSE_OIDC_ENABLED: 'true',
        QHSE_OIDC_ISSUER: 'https://identity.example.com',
        QHSE_OIDC_CLIENT_ID: 'qhse',
        QHSE_OIDC_REDIRECT_URI: 'http://qhse.example.com/callback',
        QHSE_WEB_LOGIN_URL: 'https://qhse.example.com/user/login',
      }),
    ).toThrow('must use HTTPS');
  });
});
