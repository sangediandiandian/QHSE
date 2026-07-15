import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { RequestWithId } from '../../common/request-context.middleware';

export const CurrentPrincipal = createParamDecorator((_data: unknown, context: ExecutionContext) => (
  context.switchToHttp().getRequest<RequestWithId>().principal
));
