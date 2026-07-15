import {
  CallHandler,
  ExecutionContext,
  Injectable,
  StreamableFile,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { RequestWithId } from './request-context.middleware';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    return next.handle().pipe(
      map((data) =>
        data instanceof StreamableFile
          ? data
          : {
              success: true,
              data,
              requestId: request.requestId,
              timestamp: new Date().toISOString(),
            },
      ),
    );
  }
}
