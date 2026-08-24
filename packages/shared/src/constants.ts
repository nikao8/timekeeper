import type { HolidayScope, TimeEntryType, TimeOffStatus, WorkStatus } from './enums';

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export const REFRESH_TOKEN_COOKIE = 'refresh_token';

export const WEEKDAY_LABELS_PT: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
};

export const TIME_ENTRY_LABELS_PT: Record<string, string> = {
  ENTRADA: 'Entrada',
  SAIDA_ALMOCO: 'Saída para almoço',
  RETORNO_ALMOCO: 'Retorno do almoço',
  SAIDA: 'Saída',
};

export const WORK_STATUS_LABELS_PT: Record<string, string> = {
  FORA_DO_TRABALHO: 'Fora do trabalho',
  EM_JORNADA: 'Trabalhando',
  EM_ALMOCO: 'Em horário de almoço',
  JORNADA_FINALIZADA: 'Jornada de trabalho finalizada',
};

export const TIME_OFF_STATUS_LABELS_PT: Record<string, string> = {
  PENDENTE: 'Pendente',
  APROVADA: 'Aprovada',
  REJEITADA: 'Rejeitada',
  CANCELADA: 'Cancelada',
};

export const HOLIDAY_SCOPE_LABELS_PT: Record<string, string> = {
  NATIONAL: 'Nacional',
  STATE: 'Estadual',
  MUNICIPAL: 'Municipal',
};

function labelOf(map: Record<string, string>, value: string): string {
  return map[value] ?? value;
}

export function translateWorkStatus(status: WorkStatus | string): string {
  return labelOf(WORK_STATUS_LABELS_PT, status);
}

export function translateTimeEntryType(type: TimeEntryType | string): string {
  return labelOf(TIME_ENTRY_LABELS_PT, type);
}

export function translateTimeOffStatus(status: TimeOffStatus | string): string {
  return labelOf(TIME_OFF_STATUS_LABELS_PT, status);
}

export function translateHolidayScope(scope: HolidayScope | string): string {
  return labelOf(HOLIDAY_SCOPE_LABELS_PT, scope);
}
