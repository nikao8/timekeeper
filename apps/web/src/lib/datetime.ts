const BR_TZ = 'America/Sao_Paulo';
const BR_LOCALE = 'pt-BR';

function asString(value: string | Date): string {
  return typeof value === 'string' ? value : value.toISOString();
}

/** Calendar date from ISO / Prisma `@db.Date` without timezone shifting the day. */
function calendarParts(value: string): { year: string; month: string; day: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    return null;
  }
  return { year: match[1], month: match[2], day: match[3] };
}

export function formatDateBR(value: string | Date | null | undefined): string {
  if (!value) {
    return '—';
  }
  const raw = asString(value);
  const parts = calendarParts(raw);
  if (parts) {
    return `${parts.day}/${parts.month}/${parts.year}`;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleDateString(BR_LOCALE, {
    timeZone: BR_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatTimeBR(value: string | Date | null | undefined): string {
  if (!value) {
    return '—';
  }
  if (typeof value === 'string' && /^\d{1,2}:\d{2}/.test(value)) {
    const [hours, minutes] = value.split(':');
    return `${hours.padStart(2, '0')}:${minutes.slice(0, 2)}`;
  }
  const date = new Date(asString(value));
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleTimeString(BR_LOCALE, {
    timeZone: BR_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDateTimeBR(value: string | Date | null | undefined): string {
  if (!value) {
    return '—';
  }
  const raw = asString(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return formatDateBR(raw);
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  const day = date.toLocaleDateString(BR_LOCALE, {
    timeZone: BR_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const time = date.toLocaleTimeString(BR_LOCALE, {
    timeZone: BR_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${day} ${time}`;
}

export function formatLongDateBR(value: Date = new Date()): string {
  return value.toLocaleDateString(BR_LOCALE, {
    timeZone: BR_TZ,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatClockBR(value: Date = new Date()): string {
  return value.toLocaleTimeString(BR_LOCALE, {
    timeZone: BR_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function hourInBrazil(value: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat('pt-BR', {
    timeZone: BR_TZ,
    hour: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(value)
    .find((part) => part.type === 'hour')?.value;
  return Number(hour ?? 0);
}

/** `YYYY-MM` for `<input type="month">`, based on Brazil calendar. */
export function currentYearMonthBR(value: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year}-${month}`;
}
