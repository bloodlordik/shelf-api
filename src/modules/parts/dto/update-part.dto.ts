import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PartAttributeValueInputDto } from './create-part.dto';

export class UpdatePartDto {
  @ApiPropertyOptional({
    example: 'Резистор SMD 10 кОм 0805 1%',
    description: 'Наименование детали',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    example: 'RES-0805-10K-1%',
    description: 'Уникальный артикул (SKU)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @ApiPropertyOptional({
    example: 'Обновленное описание детали',
    description: 'Описание детали',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: '7b8f9e10-1234-4567-89ab-cdef01234567',
    description: 'ID категории',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['7b8f9e10-1234-4567-89ab-cdef01234567'],
    description: 'Список UUID тегов детали',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  tagIds?: string[];

  @ApiPropertyOptional({
    type: [PartAttributeValueInputDto],
    description: 'Динамические атрибуты детали (обновление / добавление)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartAttributeValueInputDto)
  attributes?: PartAttributeValueInputDto[];

  @ApiPropertyOptional({
    example: 42,
    description:
      'Целочисленный ID актора (если передаются attributes для записи в audit-лог)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  actorId?: number;
}
