import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
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
      'Фильтрация по динамическим EAV/JSONB атрибутам детали.\n\n' +
      '**Поддерживаемые форматы сериализации:**\n' +
      '1. **deepObject (query string):** `attr[key][op]=val` или `attr[key]=val`\n' +
      '   - Диапазоны: `attr[nominal_voltage][gte]=5&attr[nominal_voltage][lte]=12`\n' +
      '   - Точное совпадение: `attr[package_type][eq]=smd_0805` или `attr[package_type]=smd_0805`\n' +
      '   - Вхождение в список: `attr[package_type][in]=smd_0805,smd_0603`\n' +
      '   - Логические флаги: `attr[rohs]=true`\n' +
      '2. **JSON-строка:** `attr={"nominal_voltage":{"gte":5,"lte":12},"package_type":"smd_0805"}`\n\n' +
      '**Операторы фильтрации:**\n' +
      '- `gte` — больше или равно (для числовых характеристик)\n' +
      '- `lte` — меньше или равно (для числовых характеристик)\n' +
      '- `eq` — строгое равенство (строка, число, boolean)\n' +
      '- `in` — список допустимых значений (строка через запятую или массив строк)',
    example: {
      nominal_voltage: { gte: 5, lte: 12 },
      package_type: 'smd_0805',
    },
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

  @ApiPropertyOptional({
    description: 'Минимальный остаток на складе',
    example: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  minQuantity?: number;

  @ApiPropertyOptional({
    description: 'Максимальный остаток на складе',
    example: 5,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  maxQuantity?: number;

  @ApiPropertyOptional({
    description: 'Поле сортировки',
    enum: ['createdAt', 'quantity', 'name', 'sku'],
    example: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'quantity', 'name', 'sku'])
  sortBy?: 'createdAt' | 'quantity' | 'name' | 'sku';

  @ApiPropertyOptional({
    description: 'Направление сортировки',
    enum: ['ASC', 'DESC'],
    example: 'DESC',
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc';

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}
