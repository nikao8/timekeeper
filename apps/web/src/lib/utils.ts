import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMinutes(minutes: number, signed = true): string {
  const sign = signed ? (minutes < 0 ? '-' : minutes > 0 ? '+' : '') : minutes < 0 ? '-' : '';
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60)
    .toString()
    .padStart(2, '0');
  const mins = (abs % 60).toString().padStart(2, '0');
  return `${sign}${hours}:${mins}`;
}
