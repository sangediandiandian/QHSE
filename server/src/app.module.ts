import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { RequestContextMiddleware } from './common/request-context.middleware';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { RiskModule } from './modules/risks/risk.module';
import { HazardModule } from './modules/hazards/hazard.module';
import { WorkPermitModule } from './modules/work-permits/work-permit.module';

@Module({
  imports: [DatabaseModule, AuthModule, AuditModule, RiskModule, HazardModule, WorkPermitModule],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('{*path}');
  }
}
