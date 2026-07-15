import {
  CallHandler,
  ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { catchError, tap, throwError } from 'rxjs';
import type { RequestWithId } from '../../common/request-context.middleware';
import { AUDIT_ACTION_KEY } from './audit.decorator';
import { AuditService } from './audit.service';
import type { AuditMetadata, AuditResult } from './audit.types';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.getAllAndOverride<AuditMetadata>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!metadata) return next.handle();

    const request = context.switchToHttp().getRequest<RequestWithId>();
    const startedAt = Date.now();
    const record = (result: AuditResult, error?: unknown) => {
      const errorStatus = typeof error === 'object' && error && 'status' in error
        ? Number((error as { status: unknown }).status)
        : undefined;
      void this.auditService.record({
        requestId: request.requestId,
        actorId: request.principal?.userId,
        actorName: request.principal?.name,
        action: metadata.action,
        resourceType: metadata.resourceType,
        resourceId: metadata.resourceIdParam ? request.params[metadata.resourceIdParam] : undefined,
        result,
        method: request.method,
        path: request.path,
        ip: request.ip,
        durationMs: Date.now() - startedAt,
        detail: {
          ...(metadata.includeUsername ? { username: request.body?.username } : {}),
          ...(errorStatus ? { statusCode: errorStatus } : {}),
        },
      });
    };

    return next.handle().pipe(
      tap(() => record('success')),
      catchError((error) => {
        record('failure', error);
        return throwError(() => error);
      }),
    );
  }
}
