import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { DateTimeModule } from './common/datetime/datetime.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AppConfigModule } from './config/app-config.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EmployeesModule } from './employees/employees.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { HolidaysModule } from './holidays/holidays.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { TimeBankModule } from './time-bank/time-bank.module';
import { TimeClockModule } from './time-clock/time-clock.module';
import { TimeOffModule } from './time-off/time-off.module';
import { VacationModule } from './vacations/vacation.module';
import { WorkSchedulesModule } from './work-schedules/work-schedules.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    DateTimeModule,
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
    }),
    HealthModule,
    AuthModule,
    EmployeesModule,
    WorkSchedulesModule,
    TimeClockModule,
    TimeBankModule,
    TimeOffModule,
    VacationModule,
    NotificationsModule,
    HolidaysModule,
    ReportsModule,
    AuditModule,
    DashboardModule,
    EventsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
