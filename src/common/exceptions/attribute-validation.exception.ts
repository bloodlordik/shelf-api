import { HttpException, HttpStatus } from '@nestjs/common';

export interface AttributeValidationErrorDetail {
  field?: string;
  key?: string;
  attributeDefinitionId?: string;
  message: string;
  value?: unknown;
}

export class AttributeValidationException extends HttpException {
  constructor(public readonly errors: AttributeValidationErrorDetail[]) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Attribute Validation Failed',
        message: 'One or more dynamic attributes failed validation',
        details: errors,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
