import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttributeChangeType } from '../enums/attribute-change-type.enum';

export class AttributeValueHistoryResponseDto {
  @ApiProperty({ example: '7b8f9e10-1234-4567-89ab-cdef01234567' })
  id!: string;

  @ApiProperty({ example: '7b8f9e10-1234-4567-89ab-cdef01234567' })
  partId!: string;

  @ApiPropertyOptional({ example: 'RES-0805-10K-1%' })
  partSku?: string;

  @ApiPropertyOptional({ example: 'Резистор SMD 10 кОм 0805 1%' })
  partName?: string;

  @ApiProperty({ example: '7b8f9e10-1234-4567-89ab-cdef01234567' })
  attributeDefinitionId!: string;

  @ApiPropertyOptional({ example: 'nominal_voltage' })
  attributeKey?: string;

  @ApiPropertyOptional({ example: 'Номинальное напряжение' })
  attributeName?: string;
  @ApiPropertyOptional({ example: 'Номинальное напряжение' })
  attributeLabel?: string;

  @ApiProperty({
    enum: AttributeChangeType,
    example: AttributeChangeType.UPDATED,
  })
  changeType!: AttributeChangeType;

  @ApiPropertyOptional({ example: 12 })
  oldValue?: unknown;

  @ApiPropertyOptional({ example: 24 })
  newValue?: unknown;

  @ApiPropertyOptional({ example: '12 В' })
  oldValueFormatted?: string | null;

  @ApiPropertyOptional({ example: '24 В' })
  newValueFormatted?: string | null;

  @ApiProperty({ example: 42, description: 'Целочисленный ID актора' })
  changedBy!: number;

  @ApiProperty({ example: '2026-09-24T10:00:00.000Z' })
  changedAt!: Date;
}
