import { Global, Module } from '@nestjs/common';
import { AccessLogMiddleware } from './access-log.middleware';
import { StructuredLoggerService } from './structured-logger.service';
import { TracingService } from '../tracing/tracing.service';

@Global()
@Module({
  providers: [
    { provide: StructuredLoggerService, useFactory: () => new StructuredLoggerService() },
    { provide: TracingService, useFactory: () => TracingService.fromEnvironment() },
    AccessLogMiddleware,
  ],
  exports: [StructuredLoggerService, TracingService, AccessLogMiddleware],
})
export class LoggingModule {}
