import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { StockMovementType } from '../enums/stock-movement-type.enum';

export class CreateStockMovementDto {
  @ApiProperty({
    example: 42,
    description:
      'Целочисленный ID актора (пользователя), выполняющего движение',
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  actorId!: number;

  @ApiProperty({ enum: StockMovementType, example: StockMovementType.RECEIPT })
  @IsEnum(StockMovementType)
  @IsNotEmpty()
  type!: StockMovementType;

  @ApiPropertyOptional({
    example: 50,
    description:
      'Количество для receipt, writeoff, transfer_in, transfer_out (положительное целое число)',
  })
  @ValidateIf(
    (o: CreateStockMovementDto) =>
      o.type !== StockMovementType.CORRECTION || o.targetQuantity === undefined,
  )
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({
    example: 120,
    description: 'Целевой остаток при инвентаризации (только для correction)',
  })
  @ValidateIf(
    (o: CreateStockMovementDto) =>
      o.type === StockMovementType.CORRECTION && o.quantity === undefined,
  )
  @IsInt()
  @Min(0)
  targetQuantity?: number;

  @ApiPropertyOptional({
    example: 'Поступление от поставщика',
    description: 'Причина движения (необязательное поле)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    example: 'ТТН-2026-09-00451',
    description: 'Номер документа (необязательное поле)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  referenceDoc?: string;
}
