export const Role = {
  FUNCIONARIO: 'FUNCIONARIO',
  GESTOR: 'GESTOR',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const TimeEntryType = {
  ENTRADA: 'ENTRADA',
  SAIDA_ALMOCO: 'SAIDA_ALMOCO',
  RETORNO_ALMOCO: 'RETORNO_ALMOCO',
  SAIDA: 'SAIDA',
} as const;
export type TimeEntryType = (typeof TimeEntryType)[keyof typeof TimeEntryType];

export const TimeEntrySource = {
  CLOCK: 'CLOCK',
  ADJUSTMENT: 'ADJUSTMENT',
  SYSTEM: 'SYSTEM',
} as const;
export type TimeEntrySource = (typeof TimeEntrySource)[keyof typeof TimeEntrySource];

export const WorkStatus = {
  FORA_DO_TRABALHO: 'FORA_DO_TRABALHO',
  EM_JORNADA: 'EM_JORNADA',
  EM_ALMOCO: 'EM_ALMOCO',
  JORNADA_FINALIZADA: 'JORNADA_FINALIZADA',
} as const;
export type WorkStatus = (typeof WorkStatus)[keyof typeof WorkStatus];

export const TimeOffStatus = {
  PENDENTE: 'PENDENTE',
  APROVADA: 'APROVADA',
  REJEITADA: 'REJEITADA',
  CANCELADA: 'CANCELADA',
} as const;
export type TimeOffStatus = (typeof TimeOffStatus)[keyof typeof TimeOffStatus];

export const HolidayScope = {
  NATIONAL: 'NATIONAL',
  STATE: 'STATE',
  MUNICIPAL: 'MUNICIPAL',
} as const;
export type HolidayScope = (typeof HolidayScope)[keyof typeof HolidayScope];

export const NotificationType = {
  TIME_ENTRY: 'TIME_ENTRY',
  TIME_OFF_REQUEST: 'TIME_OFF_REQUEST',
  TIME_OFF_DECISION: 'TIME_OFF_DECISION',
  VACATION_REQUEST: 'VACATION_REQUEST',
  VACATION_DECISION: 'VACATION_DECISION',
  MISSING_CLOCK_OUT: 'MISSING_CLOCK_OUT',
  GENERIC: 'GENERIC',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const TimeBankTransactionType = {
  DAILY_BALANCE: 'DAILY_BALANCE',
  ADJUSTMENT: 'ADJUSTMENT',
  TIME_OFF: 'TIME_OFF',
  RECALCULATION: 'RECALCULATION',
} as const;
export type TimeBankTransactionType =
  (typeof TimeBankTransactionType)[keyof typeof TimeBankTransactionType];

export const NEXT_CLOCK_ACTION: Record<WorkStatus, TimeEntryType[]> = {
  FORA_DO_TRABALHO: ['ENTRADA'],
  EM_JORNADA: ['SAIDA_ALMOCO', 'SAIDA'],
  EM_ALMOCO: ['RETORNO_ALMOCO'],
  JORNADA_FINALIZADA: [],
};
