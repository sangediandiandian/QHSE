import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestWithId } from '../../common/request-context.middleware';
import { AuditService } from '../audit/audit.service';
import type { Permission } from '../iam/iam.types';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { REQUIRED_PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || request.path.startsWith('/api/docs')) return true;

    const authorization = request.header('authorization');
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      this.recordSecurityFailure(request, 'security.auth_required');
      throw new UnauthorizedException({ code: 'AUTH_REQUIRED', message: '请先登录' });
    }

    request.accessToken = match[1];
    try {
      request.principal = await this.authService.authenticate(match[1]);
    } catch (error) {
      this.recordSecurityFailure(
        request,
        error instanceof ServiceUnavailableException
          ? 'security.session_store_unavailable'
          : 'security.session_invalid',
      );
      throw error;
    }
    const required = this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? [];
    const missing = required.filter((permission) => !request.principal?.permissions.includes(permission));
    if (missing.length > 0) {
      this.recordSecurityFailure(request, 'security.permission_denied', { missingPermissions: missing });
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: '当前角色无权执行此操作',
        details: { missingPermissions: missing },
      });
    }
    return true;
  }

  private recordSecurityFailure(
    request: RequestWithId,
    action: string,
    detail?: Record<string, unknown>,
  ) {
    void this.auditService.record({
      requestId: request.requestId,
      actorId: request.principal?.userId,
      actorName: request.principal?.name,
      action,
      resourceType: 'http_request',
      result: 'failure',
      method: request.method,
      path: request.path,
      ip: request.ip,
      durationMs: 0,
      detail,
    });
  }
}
