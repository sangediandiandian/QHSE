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

@ApiExcludeController()
@Controller()
export class LegacyAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login/account')
  @HttpCode(200)
  @Public()
  @AuditAction({ action: 'auth.login', resourceType: 'session', includeUsername: true })
  login(@Body() input: LoginDto) {
    const result = this.authService.login(input.username, input.password);
    return {
      status: 'ok',
      type: input.type || 'account',
      currentAuthority: result.user.roles[0],
      ...result,
    };
  }

  @Get('currentUser')
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
    };
  }

  @Post('login/outLogin')
  @HttpCode(200)
  @AuditAction({ action: 'auth.logout', resourceType: 'session' })
  logout(@CurrentRequest() request: RequestWithId) {
    this.authService.logout(request.accessToken || '');
    return { loggedOut: true };
  }
}
