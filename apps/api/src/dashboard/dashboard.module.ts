import { Module } from '@nestjs/common';
import { TimeClockModule } from '../time-clock/time-clock.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TimeClockModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
