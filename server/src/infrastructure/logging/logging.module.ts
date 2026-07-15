import { Global, Module } from '@nestjs/common';
import { AccessLogMiddleware } from './access-log.middleware';
import { StructuredLoggerService } from './structured-logger.service';

@Global()
@Module({
  providers: [
    { provide: StructuredLoggerService, useFactory: () => new StructuredLoggerService() },
    AccessLogMiddleware,
  ],
  exports: [StructuredLoggerService, AccessLogMiddleware],
})
export class LoggingModule {}
