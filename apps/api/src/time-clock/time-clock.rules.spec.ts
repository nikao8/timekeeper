import { TimeEntryType, WorkStatus } from '@timekeeper/shared';
import {
  allowedTypes,
  computeDailyBalance,
  computeWorkedMinutes,
  deriveWorkStatus,
  nextStatus,
} from './time-clock.rules';

function at(hours: number, minutes = 0): Date {
  return new Date(Date.UTC(2026, 7, 24, hours + 3, minutes, 0));
}

describe('time-clock.rules', () => {
  describe('sequence', () => {
    it('allows the canonical journey Entrada → almoço → retorno → saída', () => {
      const entries = [
        { type: TimeEntryType.ENTRADA, occurredAt: at(8, 2) },
        { type: TimeEntryType.SAIDA_ALMOCO, occurredAt: at(12, 1) },
        { type: TimeEntryType.RETORNO_ALMOCO, occurredAt: at(13, 3) },
        { type: TimeEntryType.SAIDA, occurredAt: at(18, 7) },
      ];
      expect(deriveWorkStatus(entries)).toBe(WorkStatus.JORNADA_FINALIZADA);
    });

    it('rejects saída without entrada', () => {
      expect(nextStatus(WorkStatus.FORA_DO_TRABALHO, TimeEntryType.SAIDA)).toBeNull();
      expect(allowedTypes(WorkStatus.FORA_DO_TRABALHO)).toEqual([TimeEntryType.ENTRADA]);
    });

    it('rejects retorno without lunch', () => {
      expect(nextStatus(WorkStatus.EM_JORNADA, TimeEntryType.RETORNO_ALMOCO)).toBeNull();
    });

    it('rejects two consecutive entradas', () => {
      expect(nextStatus(WorkStatus.EM_JORNADA, TimeEntryType.ENTRADA)).toBeNull();
    });

    it('rejects two consecutive saídas', () => {
      expect(nextStatus(WorkStatus.JORNADA_FINALIZADA, TimeEntryType.SAIDA)).toBeNull();
    });
  });

  describe('worked minutes', () => {
    it('subtracts lunch from the journey', () => {
      const entries = [
        { type: TimeEntryType.ENTRADA, occurredAt: at(8, 0) },
        { type: TimeEntryType.SAIDA_ALMOCO, occurredAt: at(12, 0) },
        { type: TimeEntryType.RETORNO_ALMOCO, occurredAt: at(13, 0) },
        { type: TimeEntryType.SAIDA, occurredAt: at(17, 0) },
      ];
      expect(computeWorkedMinutes(entries)).toBe(8 * 60);
    });
  });
});

describe('time-bank.rules via computeDailyBalance', () => {
  it('08:00 / 08:00 = 00:00', () => {
    expect(computeDailyBalance(480, 480).deltaMinutes).toBe(0);
  });

  it('09:00 / 08:00 = +01:00', () => {
    expect(computeDailyBalance(540, 480).deltaMinutes).toBe(60);
    expect(computeDailyBalance(540, 480).extraMinutes).toBe(60);
  });

  it('07:30 / 08:00 = -00:30', () => {
    expect(computeDailyBalance(450, 480).deltaMinutes).toBe(-30);
    expect(computeDailyBalance(450, 480).negativeMinutes).toBe(30);
  });
});
