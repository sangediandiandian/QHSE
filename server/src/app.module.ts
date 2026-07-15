import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { RequestContextMiddleware } from './common/request-context.middleware';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { RiskModule } from './modules/risks/risk.module';
import { HazardModule } from './modules/hazards/hazard.module';
import { WorkPermitModule } from './modules/work-permits/work-permit.module';
import { WorkflowModule } from './modules/workflows/workflow.module';
import { WarningRuleModule } from './modules/warning-rules/warning-rule.module';
import { WarningExecutionModule } from './modules/warning-execution/warning-execution.module';
import { EmergencyEventModule } from './modules/emergency-events/emergency-event.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    AuditModule,
    RiskModule,
    HazardModule,
    WorkPermitModule,
    WorkflowModule,
    WarningRuleModule,
    WarningExecutionModule,
    EmergencyEventModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('{*path}');
  }
}
