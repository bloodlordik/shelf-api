import { HttpException, HttpStatus } from '@nestjs/common';

export class DomainException extends HttpException {
  constructor(
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: unknown,
  ) {
    super(
      {
        statusCode: status,
        message,
        details,
        timestamp: new Date().toISOString(),
      },
      status,
    );
  }
}
