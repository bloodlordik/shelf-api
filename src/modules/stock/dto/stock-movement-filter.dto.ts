import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { StockMovementType } from '../enums/stock-movement-type.enum';

export class StockMovementFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: StockMovementType })
  @IsOptional()
  @IsEnum(StockMovementType)
  type?: StockMovementType;

  @ApiPropertyOptional({
    example: '2026-09-01T00:00:00.000Z',
    format: 'date-time',
    description: 'Начальная дата выборки (ISO 8601)',
  })
  @IsOptional()
  @IsISO8601()
  fromDate?: string;

  @ApiPropertyOptional({
    example: '2026-09-24T23:59:59.999Z',
    format: 'date-time',
    description: 'Конечная дата выборки (ISO 8601)',
  })
  @IsOptional()
  @IsISO8601()
  toDate?: string;

  @ApiPropertyOptional({
    example: 42,
    description: 'Фильтр по целочисленному ID актора',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  performedBy?: number;
}
