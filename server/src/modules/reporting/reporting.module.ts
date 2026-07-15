import { Module } from '@nestjs/common';
import { EmergencyEventModule } from '../emergency-events/emergency-event.module';
import { EmergencyEventService } from '../emergency-events/emergency-event.service';
import { HazardModule } from '../hazards/hazard.module';
import { HazardService } from '../hazards/hazard.service';
import { WarningExecutionModule } from '../warning-execution/warning-execution.module';
import { WarningExecutionService } from '../warning-execution/warning-execution.service';
import { WorkPermitModule } from '../work-permits/work-permit.module';
import { WorkPermitService } from '../work-permits/work-permit.service';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { ReportExportQueueService } from './report-export-queue.service';

@Module({
  imports: [HazardModule, WorkPermitModule, WarningExecutionModule, EmergencyEventModule],
  controllers: [ReportingController],
  providers: [
    {
      provide: ReportingService,
      inject: [HazardService, WorkPermitService, WarningExecutionService, EmergencyEventService],
      useFactory: (
        hazards: HazardService,
        permits: WorkPermitService,
        warnings: WarningExecutionService,
        emergencies: EmergencyEventService,
      ) => new ReportingService(hazards, permits, warnings, emergencies),
    },
    ReportExportQueueService,
  ],
  exports: [ReportExportQueueService],
})
export class ReportingModule {}
