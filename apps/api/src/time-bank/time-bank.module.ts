import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees/employees.module';
import { WorkSchedulesModule } from '../work-schedules/work-schedules.module';
import { TimeBankController } from './time-bank.controller';
import { TimeBankService } from './time-bank.service';

@Module({
  imports: [EmployeesModule, WorkSchedulesModule],
  controllers: [TimeBankController],
  providers: [TimeBankService],
  exports: [TimeBankService],
})
export class TimeBankModule {}
