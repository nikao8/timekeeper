import { TimeOffStatus } from '@prisma/client';
import { ErrorCode } from '@timekeeper/shared';
import { AppException } from '../common/errors/app.exception';

describe('time-off status transitions', () => {
  it('allows pending → approved', () => {
    expect(canReview(TimeOffStatus.PENDENTE)).toBe(true);
  });

  it('rejects review of already decided requests', () => {
    expect(canReview(TimeOffStatus.APROVADA)).toBe(false);
    expect(canReview(TimeOffStatus.REJEITADA)).toBe(false);
    expect(canReview(TimeOffStatus.CANCELADA)).toBe(false);
  });

  it('requires a reason when rejecting', () => {
    expect(() => assertRejectionReason(undefined)).toThrow(AppException);
    try {
      assertRejectionReason('   ');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).errorCode).toBe(ErrorCode.TIME_OFF_REJECTION_REASON_REQUIRED);
    }
    expect(() => assertRejectionReason('Equipe reduzida')).not.toThrow();
  });
});

function canReview(status: TimeOffStatus): boolean {
  return status === TimeOffStatus.PENDENTE;
}

function assertRejectionReason(notes?: string): void {
  if (!notes?.trim()) {
    throw new AppException(
      ErrorCode.TIME_OFF_REJECTION_REASON_REQUIRED,
      'Informe o motivo da rejeição.',
    );
  }
}
