import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ErrorCode } from '@timekeeper/shared';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = ErrorCode.INTERNAL_ERROR;
    let message = 'Erro interno do servidor.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'object' && payload !== null && 'error' in payload) {
        const error = (payload as { error: { code?: ErrorCode; message?: string } }).error;
        code = error.code ?? this.statusToCode(status);
        message = error.message ?? exception.message;
      } else if (typeof payload === 'object' && payload !== null && 'message' in payload) {
        const raw = (payload as { message: string | string[] }).message;
        message = Array.isArray(raw) ? raw.join('; ') : raw;
        code =
          status === 401
            ? ErrorCode.UNAUTHORIZED
            : status === 403
              ? ErrorCode.FORBIDDEN
              : status === 429
                ? ErrorCode.RATE_LIMITED
                : ErrorCode.VALIDATION_ERROR;
      } else {
        message = exception.message;
        code = this.statusToCode(status);
      }
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} → ${status} ${code}: ${message}`);
    }

    response.status(status).json({
      success: false,
      error: { code, message },
    });
  }

  private statusToCode(status: number): ErrorCode {
    switch (status) {
      case 401:
        return ErrorCode.UNAUTHORIZED;
      case 403:
        return ErrorCode.FORBIDDEN;
      case 404:
        return ErrorCode.NOT_FOUND;
      case 409:
        return ErrorCode.CONFLICT;
      case 429:
        return ErrorCode.RATE_LIMITED;
      case 400:
        return ErrorCode.VALIDATION_ERROR;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}
