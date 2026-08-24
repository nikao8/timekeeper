import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees/employees.module';
import { WorkScheduleService } from './work-schedule.service';
import { WorkSchedulesController } from './work-schedules.controller';

@Module({
  imports: [EmployeesModule],
  controllers: [WorkSchedulesController],
  providers: [WorkScheduleService],
  exports: [WorkScheduleService],
})
export class WorkSchedulesModule {}
