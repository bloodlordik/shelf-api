import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { StockMovementFilterDto } from './stock-movement-filter.dto';

export class GlobalStockMovementFilterDto extends StockMovementFilterDto {
  @ApiPropertyOptional({
    example: '7b8f9e10-1234-4567-89ab-cdef01234567',
    description: 'Фильтр по UUID детали',
  })
  @IsOptional()
  @IsUUID()
  partId?: string;

  @ApiPropertyOptional({
    example: 'RES-0805-10K-1%',
    description: 'Фильтр по SKU детали',
  })
  @IsOptional()
  @IsString()
  sku?: string;
}
