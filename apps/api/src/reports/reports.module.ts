import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees/employees.module';
import { ReportsController } from './reports.controller';

@Module({
  imports: [EmployeesModule],
  controllers: [ReportsController],
})
export class ReportsModule {}
