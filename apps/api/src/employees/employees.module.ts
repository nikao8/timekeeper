import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EmployeeAccessService } from './employee-access.service';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  imports: [AuditModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, EmployeeAccessService],
  exports: [EmployeesService, EmployeeAccessService],
})
export class EmployeesModule {}
