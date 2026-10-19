import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const rawMessage =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : typeof exceptionResponse === 'object' &&
            exceptionResponse !== null &&
            'message' in exceptionResponse
          ? exceptionResponse.message
          : undefined;
    const details = Array.isArray(rawMessage) ? rawMessage.map(String) : [];
    const message =
      typeof rawMessage === 'string'
        ? rawMessage
        : status >= 500
          ? 'An unexpected error occurred'
          : 'Request could not be completed';
    if (status >= 500) {
      this.logger.error('Unhandled API exception', exception);
    }
    response.status(status).json({
      success: false,
      error: {
        code: errorCode(status),
        message,
        details,
      },
    });
  }
}

function errorCode(status: number): string {
  if (status === 400) return 'VALIDATION_ERROR';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  return status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR';
}
