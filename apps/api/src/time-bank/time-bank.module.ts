import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EmployeesModule } from '../employees/employees.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkSchedulesModule } from '../work-schedules/work-schedules.module';
import { TimeBankController } from './time-bank.controller';
import { TimeBankService } from './time-bank.service';

@Module({
  imports: [EmployeesModule, WorkSchedulesModule, NotificationsModule, AuditModule],
  controllers: [TimeBankController],
  providers: [TimeBankService],
  exports: [TimeBankService],
})
export class TimeBankModule {}
