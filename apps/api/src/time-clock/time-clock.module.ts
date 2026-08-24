import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EmployeesModule } from '../employees/employees.module';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TimeBankModule } from '../time-bank/time-bank.module';
import { WorkSchedulesModule } from '../work-schedules/work-schedules.module';
import { TimeClockController } from './time-clock.controller';
import { TimeClockService } from './time-clock.service';

@Module({
  imports: [
    EmployeesModule,
    WorkSchedulesModule,
    TimeBankModule,
    NotificationsModule,
    EventsModule,
    AuditModule,
  ],
  controllers: [TimeClockController],
  providers: [TimeClockService],
  exports: [TimeClockService],
})
export class TimeClockModule {}
