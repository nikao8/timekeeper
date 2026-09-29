import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EmployeesModule } from '../employees/employees.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TimeBankModule } from '../time-bank/time-bank.module';
import { VacationController } from './vacation.controller';
import { VacationService } from './vacation.service';

@Module({
  imports: [EmployeesModule, NotificationsModule, TimeBankModule, AuditModule],
  controllers: [VacationController],
  providers: [VacationService],
  exports: [VacationService],
})
export class VacationModule {}
