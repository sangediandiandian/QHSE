import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communications/communication.module';
import { CommunicationService } from '../communications/communication.service';
import { EmergencyEventModule } from '../emergency-events/emergency-event.module';
import { EmergencyEventService } from '../emergency-events/emergency-event.service';
import { EmergencyResourceModule } from '../emergency-resources/emergency-resource.module';
import { EmergencyResourceService } from '../emergency-resources/emergency-resource.service';
import { IamModule } from '../iam/iam.module';
import { IamService } from '../iam/iam.service';
import { RiskModule } from '../risks/risk.module';
import { RiskService } from '../risks/risk.service';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { TelemetryService } from '../telemetry/telemetry.service';
import { WarningExecutionModule } from '../warning-execution/warning-execution.module';
import { WarningExecutionService } from '../warning-execution/warning-execution.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TelemetryModule,
    RiskModule,
    WarningExecutionModule,
    CommunicationModule,
    EmergencyResourceModule,
    EmergencyEventModule,
    IamModule,
  ],
  controllers: [DashboardController],
  providers: [
    {
      provide: DashboardService,
      inject: [
        TelemetryService,
        RiskService,
        WarningExecutionService,
        CommunicationService,
        EmergencyResourceService,
        EmergencyEventService,
        IamService,
      ],
      useFactory: (
        telemetry: TelemetryService,
        risks: RiskService,
        warnings: WarningExecutionService,
        communications: CommunicationService,
        resources: EmergencyResourceService,
        emergencies: EmergencyEventService,
        iam: IamService,
      ) =>
        new DashboardService(
          telemetry,
          risks,
          warnings,
          communications,
          resources,
          emergencies,
          iam,
        ),
    },
  ],
  exports: [DashboardService],
})
export class DashboardModule {}
