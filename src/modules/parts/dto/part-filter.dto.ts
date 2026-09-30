import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class PartFilterDto {
  @ApiPropertyOptional({
    minimum: 1,
    default: 1,
    description: 'Номер страницы',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    default: 20,
    description: 'Количество элементов на странице',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 20;

  @ApiPropertyOptional({
    description: 'Поисковый запрос (по названию, SKU или описанию)',
    example: '10k',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'UUID категории для фильтрации',
    example: '7b8f9e10-1234-4567-89ab-cdef01234567',
  })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Включать ли детали из всех дочерних подкатегорий',
    default: true,
  })
  @Transform(({ value }: { value: unknown }): boolean => {
    if (value === undefined || value === null || value === '') return true;
    return value === 'true' || value === true;
  })
  @IsBoolean()
  @IsOptional()
  includeSubcategories: boolean = true;

  @ApiPropertyOptional({
    description:
      'Список UUID тегов (через запятую). Применяется строгая AND-фильтрация (все теги должны присутствовать).',
    example: 'uuid1,uuid2',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }): string[] | undefined => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string')
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    return undefined;
  })
  tagIds?: string[];

  @ApiPropertyOptional({
    description:
      'Фильтры по динамическим атрибутам, например { nominal_voltage: { gte: 5, lte: 12 }, package_type: "smd_0805" }',
  })
  @IsOptional()
  @IsObject()
  @Transform(
    ({ value }: { value: unknown }): Record<string, unknown> | undefined => {
      if (typeof value === 'string') {
        try {
          const parsed: unknown = JSON.parse(value);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
          }
          return undefined;
        } catch {
          return undefined;
        }
      }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
      return undefined;
    },
  )
  attr?: Record<string, unknown>;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}
