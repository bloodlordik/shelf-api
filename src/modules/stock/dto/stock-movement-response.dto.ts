import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockMovementType } from '../enums/stock-movement-type.enum';

export class StockMovementResponseDto {
  @ApiProperty({ example: '7b8f9e10-1234-4567-89ab-cdef01234567' })
  id!: string;

  @ApiProperty({ example: '7b8f9e10-1234-4567-89ab-cdef01234567' })
  partId!: string;

  @ApiPropertyOptional({ example: 'RES-0805-10K-1%' })
  partSku?: string;

  @ApiPropertyOptional({ example: 'Резистор SMD 10 кОм 0805 1%' })
  partName?: string;

  @ApiProperty({ enum: StockMovementType, example: StockMovementType.RECEIPT })
  movementType!: StockMovementType;

  @ApiProperty({
    example: 50,
    description: 'Изменение количества со знаком (+50 приход, -20 списание)',
  })
  quantityDelta!: number;

  @ApiProperty({
    example: 120,
    description:
      'Итоговый остаток на складе сразу после фиксации данного движения',
  })
  quantityAfter!: number;

  @ApiPropertyOptional({ example: 'Поступление по накладной' })
  reason?: string | null;

  @ApiPropertyOptional({ example: 'ТТН-2026-09-00123' })
  referenceDoc?: string | null;

  @ApiProperty({ example: 42, description: 'Целочисленный ID актора' })
  performedBy!: number;

  @ApiProperty({ example: '2026-09-24T10:00:00.000Z' })
  performedAt!: Date;
}
