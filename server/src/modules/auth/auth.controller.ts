import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RequestWithId } from '../../common/request-context.middleware';
import { AuditAction } from '../audit/audit.decorator';
import type { AuthPrincipal } from '../iam/iam.types';
import { AuthService } from './auth.service';
import { CurrentPrincipal } from './current-principal.decorator';
import { LoginDto } from './dto/login.dto';
import { Public } from './public.decorator';
import { CurrentRequest } from './current-request.decorator';
import { ChangePasswordDto, ResetPasswordDto } from './dto/change-password.dto';
import { AllowPasswordChange } from './password-change.decorator';
import { RequirePermissions } from './permissions.decorator';

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
  @AllowPasswordChange()
  @ApiBearerAuth()
  @ApiOperation({ summary: '查询当前登录用户' })
  getCurrentUser(@CurrentPrincipal() principal: AuthPrincipal) {
    return principal;
  }

  @Put('password')
  @AllowPasswordChange()
  @AuditAction({ action: 'auth.password.change', resourceType: 'user' })
  @ApiOperation({ summary: '校验当前密码并修改本人密码' })
  changePassword(@Body() input: ChangePasswordDto, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.authService.changePassword(
      principal.userId,
      input.currentPassword,
      input.newPassword,
    );
  }

  @Put('users/:id/password-reset')
  @RequirePermissions('iam:manage')
  @AuditAction({
    action: 'iam.user.password.reset',
    resourceType: 'iam_user',
    resourceIdParam: 'id',
  })
  @ApiOperation({ summary: '管理员重置用户临时密码并强制首次登录改密' })
  resetPassword(@Param('id') id: string, @Body() input: ResetPasswordDto) {
    return this.authService.resetPassword(id, input.temporaryPassword);
  }

  @Post('logout')
  @HttpCode(200)
  @AllowPasswordChange()
  @ApiBearerAuth()
  @AuditAction({ action: 'auth.logout', resourceType: 'session' })
  @ApiOperation({ summary: '退出登录' })
  async logout(@CurrentRequest() request: RequestWithId) {
    await this.authService.logout(request.accessToken || '');
    return { loggedOut: true };
  }
}
