import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class DateTimeService {
  constructor(private readonly config: AppConfigService) {}

  timezone(override?: string): string {
    return override ?? this.config.defaultTimezone;
  }

  nowUtc(): Date {
    return DateTime.utc().toJSDate();
  }

  now(tz?: string): DateTime {
    return DateTime.now().setZone(this.timezone(tz));
  }

  fromUtc(date: Date, tz?: string): DateTime {
    return DateTime.fromJSDate(date, { zone: 'utc' }).setZone(this.timezone(tz));
  }

  /** Calendar date `YYYY-MM-DD` in the given timezone. */
  calendarDate(date: Date, tz?: string): string {
    const iso = this.fromUtc(date, tz).toISODate();
    if (!iso) {
      throw new Error('Unable to derive calendar date');
    }
    return iso;
  }

  today(tz?: string): string {
    const iso = this.now(tz).toISODate();
    if (!iso) {
      throw new Error('Unable to derive today');
    }
    return iso;
  }

  weekday(isoDate: string, tz?: string): number {
    return DateTime.fromISO(isoDate, { zone: this.timezone(tz) }).weekday % 7;
  }

  startOfDayUtc(isoDate: string, tz?: string): Date {
    return DateTime.fromISO(isoDate, { zone: this.timezone(tz) })
      .startOf('day')
      .toUTC()
      .toJSDate();
  }

  endOfDayUtc(isoDate: string, tz?: string): Date {
    return DateTime.fromISO(isoDate, { zone: this.timezone(tz) })
      .endOf('day')
      .toUTC()
      .toJSDate();
  }

  dateOnly(isoDate: string): Date {
    return DateTime.fromISO(isoDate, { zone: 'utc' }).startOf('day').toJSDate();
  }

  combine(isoDate: string, hhmm: string, tz?: string): Date {
    const [hour, minute] = hhmm.split(':').map((part) => Number(part));
    return DateTime.fromISO(isoDate, { zone: this.timezone(tz) })
      .set({ hour, minute, second: 0, millisecond: 0 })
      .toUTC()
      .toJSDate();
  }

  diffMinutes(from: Date, to: Date): number {
    return Math.round(
      DateTime.fromJSDate(to, { zone: 'utc' }).diff(
        DateTime.fromJSDate(from, { zone: 'utc' }),
        'minutes',
      ).minutes,
    );
  }

  addDays(isoDate: string, days: number): string {
    const next = DateTime.fromISO(isoDate).plus({ days }).toISODate();
    if (!next) {
      throw new Error('Unable to add days');
    }
    return next;
  }

  startOfMonth(isoDate: string): string {
    const start = DateTime.fromISO(isoDate).startOf('month').toISODate();
    if (!start) {
      throw new Error('Unable to derive month start');
    }
    return start;
  }

  endOfMonth(isoDate: string): string {
    const end = DateTime.fromISO(isoDate).endOf('month').toISODate();
    if (!end) {
      throw new Error('Unable to derive month end');
    }
    return end;
  }

  formatDuration(minutes: number, signed = true): string {
    const sign = signed ? (minutes < 0 ? '-' : minutes > 0 ? '+' : '') : minutes < 0 ? '-' : '';
    const abs = Math.abs(minutes);
    const hours = Math.floor(abs / 60)
      .toString()
      .padStart(2, '0');
    const mins = (abs % 60).toString().padStart(2, '0');
    return `${sign}${hours}:${mins}`;
  }

  parseDurationToMinutes(value: string): never | number {
    const match = /^([+-])?(\d{1,3}):(\d{2})$/.exec(value.trim());
    if (!match) {
      throw new Error(`Invalid duration: ${value}`);
    }
    const minutes = Number(match[2]) * 60 + Number(match[3]);
    return match[1] === '-' ? -minutes : minutes;
  }
}
