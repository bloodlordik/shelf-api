import { ApiProperty } from '@nestjs/swagger';

export class PartsSummaryDto {
  @ApiProperty({
    description: 'Общее количество номенклатурных позиций',
    example: 150,
  })
  totalParts!: number;

  @ApiProperty({
    description: 'Суммарное количество всех физических единиц на складе',
    example: 4500,
  })
  totalQuantity!: number;

  @ApiProperty({
    description: 'Количество позиций с низким остатком (<= 5 шт)',
    example: 12,
  })
  lowStockCount!: number;

  @ApiProperty({
    description: 'Количество позиций с нулевым остатком (дефицит)',
    example: 3,
  })
  outOfStockCount!: number;
}
