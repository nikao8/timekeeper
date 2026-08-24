import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@timekeeper/shared';

export class AppException extends HttpException {
  readonly errorCode: ErrorCode;

  constructor(errorCode: ErrorCode, message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(
      {
        success: false,
        error: { code: errorCode, message },
      },
      status,
    );
    this.errorCode = errorCode;
  }
}
