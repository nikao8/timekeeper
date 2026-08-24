import { TimeEntryType, WorkStatus } from '@timekeeper/shared';

export type PunchLike = {
  type: TimeEntryType;
  occurredAt: Date;
};

export function deriveWorkStatus(entries: PunchLike[]): WorkStatus {
  const ordered = [...entries].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  let status: WorkStatus = WorkStatus.FORA_DO_TRABALHO;
  for (const entry of ordered) {
    status = nextStatus(status, entry.type) ?? status;
  }
  return status;
}

export function nextStatus(current: WorkStatus, type: TimeEntryType): WorkStatus | null {
  switch (current) {
    case WorkStatus.FORA_DO_TRABALHO:
      return type === TimeEntryType.ENTRADA ? WorkStatus.EM_JORNADA : null;
    case WorkStatus.EM_JORNADA:
      if (type === TimeEntryType.SAIDA_ALMOCO) {
        return WorkStatus.EM_ALMOCO;
      }
      if (type === TimeEntryType.SAIDA) {
        return WorkStatus.JORNADA_FINALIZADA;
      }
      return null;
    case WorkStatus.EM_ALMOCO:
      return type === TimeEntryType.RETORNO_ALMOCO ? WorkStatus.EM_JORNADA : null;
    case WorkStatus.JORNADA_FINALIZADA:
      return null;
    default:
      return null;
  }
}

export function allowedTypes(status: WorkStatus): TimeEntryType[] {
  switch (status) {
    case WorkStatus.FORA_DO_TRABALHO:
      return [TimeEntryType.ENTRADA];
    case WorkStatus.EM_JORNADA:
      return [TimeEntryType.SAIDA_ALMOCO, TimeEntryType.SAIDA];
    case WorkStatus.EM_ALMOCO:
      return [TimeEntryType.RETORNO_ALMOCO];
    case WorkStatus.JORNADA_FINALIZADA:
      return [];
    default:
      return [];
  }
}

export function findByType(entries: PunchLike[], type: TimeEntryType): PunchLike | undefined {
  return [...entries]
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
    .find((entry) => entry.type === type);
}

export function computeWorkedMinutes(entries: PunchLike[], until: Date = new Date()): number {
  const entrada = findByType(entries, TimeEntryType.ENTRADA);
  if (!entrada) {
    return 0;
  }
  const saidaAlmoco = findByType(entries, TimeEntryType.SAIDA_ALMOCO);
  const retornoAlmoco = findByType(entries, TimeEntryType.RETORNO_ALMOCO);
  const saida = findByType(entries, TimeEntryType.SAIDA);
  const end = saida?.occurredAt ?? until;
  let minutes = diffMinutes(entrada.occurredAt, end);
  if (saidaAlmoco && retornoAlmoco) {
    minutes -= diffMinutes(saidaAlmoco.occurredAt, retornoAlmoco.occurredAt);
  } else if (saidaAlmoco && !retornoAlmoco) {
    const lunchEnd = saida?.occurredAt ?? until;
    minutes -= diffMinutes(saidaAlmoco.occurredAt, lunchEnd);
  }
  return Math.max(0, minutes);
}

export function computeDailyBalance(
  workedMinutes: number,
  expectedMinutes: number,
): {
  expectedMinutes: number;
  workedMinutes: number;
  deltaMinutes: number;
  extraMinutes: number;
  negativeMinutes: number;
} {
  const deltaMinutes = workedMinutes - expectedMinutes;
  return {
    expectedMinutes,
    workedMinutes,
    deltaMinutes,
    extraMinutes: Math.max(0, deltaMinutes),
    negativeMinutes: Math.max(0, -deltaMinutes),
  };
}

export function diffMinutes(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 60_000);
}

export function isLate(clockIn: Date, expectedStart: Date, toleranceMinutes: number): boolean {
  const allowed = new Date(expectedStart.getTime() + toleranceMinutes * 60_000);
  return clockIn.getTime() > allowed.getTime();
}

export function delayMinutes(clockIn: Date, expectedStart: Date, toleranceMinutes: number): number {
  if (!isLate(clockIn, expectedStart, toleranceMinutes)) {
    return 0;
  }
  return diffMinutes(expectedStart, clockIn);
}
