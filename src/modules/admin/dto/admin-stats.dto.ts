import { ApiProperty } from '@nestjs/swagger';
import { StockMovementResponseDto } from '../../stock/dto/stock-movement-response.dto';

export class LowStockPartSummaryDto {
  @ApiProperty({ example: '7b8f9e10-1234-4567-89ab-cdef01234567' })
  id!: string;

  @ApiProperty({ example: 'Резистор SMD 10 кОм 0805 1%' })
  name!: string;

  @ApiProperty({ example: 'RES-0805-10K-1%' })
  sku!: string;

  @ApiProperty({ example: 3 })
  quantity!: number;

  @ApiProperty({ example: 'Пассивные компоненты', nullable: true })
  categoryName!: string | null;
}

export class AdminStatsResponseDto {
  @ApiProperty({ example: 150, description: 'Общее количество деталей' })
  totalParts!: number;

  @ApiProperty({ example: 4520, description: 'Суммарный остаток всех деталей' })
  totalQuantity!: number;

  @ApiProperty({
    example: 8,
    description: 'Количество позиций с низким остатком (<= 5)',
  })
  lowStockCount!: number;

  @ApiProperty({
    example: 3,
    description: 'Количество позиций с нулевым остатком (= 0)',
  })
  outOfStockCount!: number;

  @ApiProperty({ example: 12, description: 'Количество категорий' })
  categoriesCount!: number;

  @ApiProperty({ example: 25, description: 'Количество тегов' })
  tagsCount!: number;

  @ApiProperty({
    example: 18,
    description: 'Количество динамических атрибутов',
  })
  attributesCount!: number;

  @ApiProperty({ example: 14, description: 'Количество единиц измерения' })
  unitsCount!: number;

  @ApiProperty({
    example: 84,
    description: 'Общее количество складских движений',
  })
  movementsCount!: number;

  @ApiProperty({
    type: [StockMovementResponseDto],
    description: 'Последние складские движения',
  })
  recentMovements!: StockMovementResponseDto[];

  @ApiProperty({
    type: [LowStockPartSummaryDto],
    description: 'Список позиций с критическим остатком',
  })
  lowStockParts!: LowStockPartSummaryDto[];
}
