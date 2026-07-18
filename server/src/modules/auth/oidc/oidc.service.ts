import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  type OnModuleInit,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as oidc from 'openid-client';
import { AuthService } from '../auth.service';
import { OidcFlowStoreService } from './oidc-flow-store.service';

export interface OidcSettings {
  enabled: boolean;
  issuer?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  webLoginUrl: string;
  label: string;
  usernameClaim: string;
  localLoginEnabled: boolean;
}

export interface OidcProtocol {
  discover(settings: OidcSettings): Promise<unknown>;
  createAuthorization(
    configuration: unknown,
    redirectUri: string,
  ): Promise<{ url: string; state: string; nonce: string; codeVerifier: string }>;
  exchange(
    configuration: unknown,
    currentUrl: URL,
    transaction: { state: string; nonce: string; codeVerifier: string },
  ): Promise<Record<string, unknown>>;
}

export class OpenIdClientProtocol implements OidcProtocol {
  async discover(settings: OidcSettings) {
    const issuer = new URL(settings.issuer!);
    return oidc.discovery(
      issuer,
      settings.clientId!,
      settings.clientSecret || undefined,
      undefined,
      issuer.protocol === 'http:' && process.env.NODE_ENV !== 'production'
        ? { execute: [oidc.allowInsecureRequests] }
        : undefined,
    );
  }

  async createAuthorization(configuration: unknown, redirectUri: string) {
    const config = configuration as oidc.Configuration;
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const url = oidc.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      scope: 'openid profile email',
      code_challenge: await oidc.calculatePKCECodeChallenge(codeVerifier),
      code_challenge_method: 'S256',
      state,
      nonce,
    });
    return { url: url.href, state, nonce, codeVerifier };
  }

  async exchange(
    configuration: unknown,
    currentUrl: URL,
    transaction: { state: string; nonce: string; codeVerifier: string },
  ) {
    const tokens = await oidc.authorizationCodeGrant(
      configuration as oidc.Configuration,
      currentUrl,
      {
        pkceCodeVerifier: transaction.codeVerifier,
        expectedState: transaction.state,
        expectedNonce: transaction.nonce,
        idTokenExpected: true,
      },
    );
    const claims = tokens.claims();
    if (!claims) throw new Error('OIDC ID token claims missing');
    return claims as Record<string, unknown>;
  }
}

@Injectable()
export class OidcService implements OnModuleInit {
  private readonly transactionTtlMs = 5 * 60 * 1000;
  private readonly resultTtlMs = 60 * 1000;
  private configuration?: unknown;
  private discoveryError = false;

  constructor(
    private readonly auth: AuthService,
    private readonly flows: OidcFlowStoreService,
    private readonly settings: OidcSettings,
    private readonly protocol: OidcProtocol = new OpenIdClientProtocol(),
    private readonly now: () => number = Date.now,
  ) {}

  async onModuleInit() {
    if (!this.settings.enabled) return;
    try {
      this.configuration = await this.protocol.discover(this.settings);
    } catch (error) {
      this.discoveryError = true;
      throw error;
    }
  }

  publicConfiguration() {
    return {
      enabled: this.settings.enabled,
      label: this.settings.label,
      localLoginEnabled: this.settings.localLoginEnabled,
    };
  }

  async begin() {
    const configuration = this.requireConfiguration();
    const authorization = await this.protocol.createAuthorization(
      configuration,
      this.settings.redirectUri!,
    );
    const transactionId = randomBytes(32).toString('hex');
    await this.flows.putTransaction(
      transactionId,
      {
        state: authorization.state,
        nonce: authorization.nonce,
        codeVerifier: authorization.codeVerifier,
        createdAt: this.now(),
      },
      this.transactionTtlMs,
    );
    return { authorizationUrl: authorization.url, transactionId };
  }

  async complete(currentUrl: URL, transactionId: string) {
    const configuration = this.requireConfiguration();
    const transaction = await this.flows.takeTransaction(transactionId);
    if (!transaction) {
      throw new BadRequestException({
        code: 'OIDC_TRANSACTION_INVALID',
        message: '统一认证流程已失效，请重新登录',
      });
    }
    let claims: Record<string, unknown>;
    try {
      claims = await this.protocol.exchange(configuration, currentUrl, transaction);
    } catch {
      throw new UnauthorizedException({
        code: 'OIDC_CALLBACK_INVALID',
        message: '统一认证回调校验失败',
      });
    }
    const candidate = claims[this.settings.usernameClaim];
    if (typeof candidate !== 'string' || !candidate.trim()) {
      throw new UnauthorizedException({
        code: 'OIDC_USERNAME_CLAIM_MISSING',
        message: '统一身份缺少账号映射声明',
      });
    }
    const login = await this.auth.loginFederated(candidate.trim().toLowerCase());
    const completionCode = randomBytes(32).toString('hex');
    await this.flows.putResult(
      completionCode,
      {
        accessToken: login.accessToken,
        expiresIn: login.expiresIn,
        passwordChangeRequired: false,
        createdAt: this.now(),
      },
      this.resultTtlMs,
    );
    return { completionCode, username: candidate.trim().toLowerCase() };
  }

  async exchangeCompletion(completionCode: string) {
    const result = await this.flows.takeResult(completionCode);
    if (!result) {
      throw new BadRequestException({
        code: 'OIDC_COMPLETION_INVALID',
        message: '统一认证登录结果已失效，请重新登录',
      });
    }
    return {
      status: 'ok',
      type: 'account',
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      passwordChangeRequired: false,
    };
  }

  snapshot() {
    return {
      enabled: this.settings.enabled,
      status: this.discoveryError ? 'degraded' : this.settings.enabled ? 'ready' : 'disabled',
      flowStore: this.flows.backend,
      localLoginEnabled: this.settings.localLoginEnabled,
      usernameClaim: this.settings.usernameClaim,
    };
  }

  check() {
    if (!this.settings.enabled) return Promise.resolve();
    this.requireConfiguration();
    return this.flows.check();
  }

  loginRedirect(completionCode?: string, errorCode?: string) {
    const url = new URL(this.settings.webLoginUrl);
    if (completionCode) url.searchParams.set('oidc_code', completionCode);
    if (errorCode) url.searchParams.set('oidc_error', errorCode);
    return url.href;
  }

  callbackUrl(query: Record<string, unknown>) {
    const url = new URL(this.settings.redirectUri!);
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string') url.searchParams.set(key, value);
    }
    return url;
  }

  private requireConfiguration() {
    if (!this.settings.enabled || !this.configuration) {
      throw new ServiceUnavailableException({
        code: 'OIDC_NOT_AVAILABLE',
        message: '企业统一认证暂不可用',
      });
    }
    return this.configuration;
  }
}

function assertHttpUrl(value: string, name: string, production: boolean) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error(`${name} must be an HTTP(S) URL without embedded credentials`);
  }
  if (production && url.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS in production`);
  }
}

export function oidcSettingsFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): OidcSettings {
  const enabled = environment.QHSE_OIDC_ENABLED === 'true';
  const localLoginEnabled = environment.QHSE_LOCAL_LOGIN_ENABLED !== 'false';
  const production = environment.NODE_ENV === 'production';
  const settings: OidcSettings = {
    enabled,
    issuer: environment.QHSE_OIDC_ISSUER,
    clientId: environment.QHSE_OIDC_CLIENT_ID,
    clientSecret: environment.QHSE_OIDC_CLIENT_SECRET,
    redirectUri: environment.QHSE_OIDC_REDIRECT_URI,
    webLoginUrl: environment.QHSE_WEB_LOGIN_URL || 'http://127.0.0.1:8000/user/login',
    label: environment.QHSE_OIDC_LABEL || '企业统一认证',
    usernameClaim: environment.QHSE_OIDC_USERNAME_CLAIM || 'preferred_username',
    localLoginEnabled,
  };
  if (enabled) {
    for (const [name, value] of [
      ['QHSE_OIDC_ISSUER', settings.issuer],
      ['QHSE_OIDC_CLIENT_ID', settings.clientId],
      ['QHSE_OIDC_REDIRECT_URI', settings.redirectUri],
    ]) {
      if (!value) throw new Error(`${name} is required when QHSE_OIDC_ENABLED=true`);
    }
    assertHttpUrl(settings.issuer!, 'QHSE_OIDC_ISSUER', production);
    assertHttpUrl(settings.redirectUri!, 'QHSE_OIDC_REDIRECT_URI', production);
  }
  assertHttpUrl(settings.webLoginUrl, 'QHSE_WEB_LOGIN_URL', production);
  if (!/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(settings.usernameClaim)) {
    throw new Error('QHSE_OIDC_USERNAME_CLAIM is invalid');
  }
  if (!localLoginEnabled && !enabled) {
    throw new Error('Local login cannot be disabled unless OIDC is enabled');
  }
  return settings;
}
