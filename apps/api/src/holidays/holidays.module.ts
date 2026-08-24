import { Module } from '@nestjs/common';
import { HolidaysController } from './holidays.controller';

@Module({
  controllers: [HolidaysController],
})
export class HolidaysModule {}
