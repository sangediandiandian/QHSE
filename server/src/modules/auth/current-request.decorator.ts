import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { RequestWithId } from '../../common/request-context.middleware';

export const CurrentRequest = createParamDecorator((_data: unknown, context: ExecutionContext) => (
  context.switchToHttp().getRequest<RequestWithId>()
));
