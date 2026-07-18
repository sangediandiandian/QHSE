import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { RequestContextMiddleware } from './common/request-context.middleware';
import { SecurityHeadersMiddleware } from './common/security-headers.middleware';
import { CacheModule } from './infrastructure/cache/cache.module';
import { LoggingModule } from './infrastructure/logging/logging.module';
import { AccessLogMiddleware } from './infrastructure/logging/access-log.middleware';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { RiskModule } from './modules/risks/risk.module';
import { HazardModule } from './modules/hazards/hazard.module';
import { WorkPermitModule } from './modules/work-permits/work-permit.module';
import { WorkflowModule } from './modules/workflows/workflow.module';
import { WarningRuleModule } from './modules/warning-rules/warning-rule.module';
import { WarningExecutionModule } from './modules/warning-execution/warning-execution.module';
import { EmergencyEventModule } from './modules/emergency-events/emergency-event.module';
import { EmergencyPlanModule } from './modules/emergency-plans/emergency-plan.module';
import { EmergencyResourceModule } from './modules/emergency-resources/emergency-resource.module';
import { CommunicationModule } from './modules/communications/communication.module';
import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { AttachmentModule } from './modules/attachments/attachment.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { PlatformConfigModule } from './modules/platform-config/platform-config.module';
import { DiagnosticsModule } from './modules/diagnostics/diagnostics.module';
import { RuntimeMetricsMiddleware } from './modules/diagnostics/runtime-metrics.middleware';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EventReviewModule } from './modules/event-reviews/event-review.module';

@Module({
  imports: [
    LoggingModule,
    HealthModule,
    CacheModule,
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
    EventReviewModule,
    EmergencyPlanModule,
    EmergencyResourceModule,
    CommunicationModule,
    TelemetryModule,
    AttachmentModule,
    ReportingModule,
    PlatformConfigModule,
    DiagnosticsModule,
    DashboardModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        RequestContextMiddleware,
        SecurityHeadersMiddleware,
        RuntimeMetricsMiddleware,
        AccessLogMiddleware,
      )
      .forRoutes('{*path}');
  }
}
