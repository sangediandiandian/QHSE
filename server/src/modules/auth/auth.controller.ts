import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RequestWithId } from '../../common/request-context.middleware';
import { AuditAction } from '../audit/audit.decorator';
import type { AuthPrincipal } from '../iam/iam.types';
import { AuthService } from './auth.service';
import { CurrentPrincipal } from './current-principal.decorator';
import { LoginDto } from './dto/login.dto';
import { Public } from './public.decorator';
import { CurrentRequest } from './current-request.decorator';

@ApiTags('认证')
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Public()
  @AuditAction({ action: 'auth.login', resourceType: 'session', includeUsername: true })
  @ApiOperation({ summary: '用户名密码登录' })
  login(@Body() input: LoginDto, @CurrentRequest() request: RequestWithId) {
    return this.authService.login(input.username, input.password, request.ip || 'unknown');
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '查询当前登录用户' })
  getCurrentUser(@CurrentPrincipal() principal: AuthPrincipal) {
    return principal;
  }

  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  @AuditAction({ action: 'auth.logout', resourceType: 'session' })
  @ApiOperation({ summary: '退出登录' })
  logout(@CurrentRequest() request: RequestWithId) {
    this.authService.logout(request.accessToken || '');
    return { loggedOut: true };
  }
}
