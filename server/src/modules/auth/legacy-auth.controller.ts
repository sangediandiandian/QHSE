import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { RequestWithId } from '../../common/request-context.middleware';
import { AuditAction } from '../audit/audit.decorator';
import type { AuthPrincipal } from '../iam/iam.types';
import { AuthService } from './auth.service';
import { CurrentPrincipal } from './current-principal.decorator';
import { CurrentRequest } from './current-request.decorator';
import { LoginDto } from './dto/login.dto';
import { Public } from './public.decorator';
import { AllowPasswordChange } from './password-change.decorator';

@ApiExcludeController()
@Controller()
export class LegacyAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login/account')
  @HttpCode(200)
  @Public()
  @AuditAction({ action: 'auth.login', resourceType: 'session', includeUsername: true })
  async login(@Body() input: LoginDto, @CurrentRequest() request: RequestWithId) {
    const result = await this.authService.login(
      input.username,
      input.password,
      request.ip || 'unknown',
    );
    return {
      status: 'ok',
      type: input.type || 'account',
      currentAuthority: result.user.roles[0],
      ...result,
    };
  }

  @Get('currentUser')
  @AllowPasswordChange()
  getCurrentUser(@CurrentPrincipal() principal: AuthPrincipal) {
    return {
      userid: principal.userId,
      name: principal.name,
      title: principal.roles.join(' / '),
      access: principal.roles.includes('system_admin') ? 'admin' : 'user',
      roles: principal.roles,
      permissions: principal.permissions,
      dataScope: principal.dataScope,
      areaIds: principal.areaIds,
      passwordChangeRequired: principal.passwordChangeRequired,
    };
  }

  @Post('login/outLogin')
  @HttpCode(200)
  @AllowPasswordChange()
  @AuditAction({ action: 'auth.logout', resourceType: 'session' })
  async logout(@CurrentRequest() request: RequestWithId) {
    await this.authService.logout(request.accessToken || '');
    return { loggedOut: true };
  }
}
