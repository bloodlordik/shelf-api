import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch(QueryFailedError)
export class TypeOrmExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(TypeOrmExceptionFilter.name);

  catch(
    exception: QueryFailedError & { code?: string; detail?: string },
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const code = exception.code;
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Database query failed';
    let details: unknown = undefined;

    switch (code) {
      case '23505': // unique_violation
        status = HttpStatus.CONFLICT;
        message = 'A record with this unique value already exists';
        details = exception.detail;
        break;
      case '23503': // foreign_key_violation
        status = HttpStatus.BAD_REQUEST;
        message =
          'Foreign key constraint violation: referenced entity does not exist or is in use';
        details = exception.detail;
        break;
      case '23502': // not_null_violation
        status = HttpStatus.BAD_REQUEST;
        message = 'Required column value is missing';
        details = exception.detail;
        break;
      case '22P02': // invalid_text_representation (e.g. invalid UUID)
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid data format or UUID syntax';
        details = exception.message;
        break;
      default:
        this.logger.error(
          `Unhandled DB error: ${exception.message}`,
          exception.stack,
        );
        message = 'Internal database error';
        break;
    }

    response.status(status).json({
      statusCode: status,
      error: HttpStatus[status],
      message,
      details,
      timestamp: new Date().toISOString(),
    });
  }
}
