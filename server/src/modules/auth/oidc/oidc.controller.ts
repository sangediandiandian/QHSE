import { Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { RequestWithId } from '../../../common/request-context.middleware';
import { AuditService } from '../../audit/audit.service';
import { Public } from '../public.decorator';
import { OidcCompletionDto } from './oidc.dto';
import { OidcService } from './oidc.service';

const TRANSACTION_COOKIE = 'qhse_oidc_transaction';

@ApiTags('统一认证')
@Controller('v1/auth/oidc')
export class OidcController {
  constructor(
    private readonly oidc: OidcService,
    private readonly audit: AuditService,
  ) {}

  @Get('config')
  @Public()
  @ApiOperation({ summary: '查询企业统一认证登录配置' })
  config() {
    return this.oidc.publicConfiguration();
  }

  @Get('start')
  @Public()
  @ApiOperation({ summary: '启动 OIDC 授权码与 PKCE 登录' })
  async start(@Res() response: Response) {
    const flow = await this.oidc.begin();
    response.cookie(TRANSACTION_COOKIE, flow.transactionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/v1/auth/oidc/callback',
      maxAge: 5 * 60 * 1000,
    });
    response.redirect(302, flow.authorizationUrl);
  }

  @Get('callback')
  @Public()
  @ApiOperation({ summary: '校验 OIDC 回调并生成一次性登录结果' })
  async callback(
    @Req() request: RequestWithId,
    @Query() query: Record<string, unknown>,
    @Res() response: Response,
  ) {
    const transactionId = this.cookie(request.headers.cookie, TRANSACTION_COOKIE);
    response.clearCookie(TRANSACTION_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/v1/auth/oidc/callback',
    });
    if (!transactionId) {
      await this.record(request, 'failure');
      response.redirect(302, this.oidc.loginRedirect(undefined, 'OIDC_TRANSACTION_INVALID'));
      return;
    }
    try {
      const result = await this.oidc.complete(this.oidc.callbackUrl(query), transactionId);
      await this.record(request, 'success', result.username);
      response.redirect(302, this.oidc.loginRedirect(result.completionCode));
    } catch {
      await this.record(request, 'failure');
      response.redirect(302, this.oidc.loginRedirect(undefined, 'OIDC_LOGIN_FAILED'));
    }
  }

  @Post('exchange')
  @Public()
  @ApiOperation({ summary: '一次性兑换 QHSE 本地会话' })
  exchange(@Body() input: OidcCompletionDto) {
    return this.oidc.exchangeCompletion(input.completionCode);
  }

  private cookie(header: string | undefined, name: string) {
    return header
      ?.split(';')
      .map((part) => part.trim().split('='))
      .find(([key]) => key === name)
      ?.slice(1)
      .join('=');
  }

  private async record(request: RequestWithId, result: 'success' | 'failure', username?: string) {
    await this.audit
      .record({
        requestId: request.requestId,
        actorName: username,
        action: 'auth.oidc.login',
        resourceType: 'session',
        result,
        method: request.method,
        path: request.path,
        ip: request.ip,
        durationMs: 0,
        detail: username ? { username } : undefined,
      })
      .catch(() => undefined);
  }
}
