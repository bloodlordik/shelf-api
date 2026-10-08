import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { CategoryResponseDto } from '../../categories/dto/category-response.dto';
import { Tag } from '../../tags/entities/tag.entity';

export class PartDto {
  @ApiProperty({
    example: '7b8f9e10-1234-4567-89ab-cdef01234567',
    description: 'UUID детали',
  })
  id!: string;

  @ApiProperty({
    example: 'Резистор SMD 10 кОм 0805 1%',
    description: 'Наименование детали',
  })
  name!: string;

  @ApiProperty({
    example: 'RES-0805-10K-1%',
    description: 'Уникальный артикул / парт-номер (SKU)',
  })
  sku!: string;

  @ApiPropertyOptional({
    example: 'Тонкопленочный чип-резистор общего применения',
    description: 'Описание детали',
    nullable: true,
  })
  description?: string | null;

  @ApiProperty({
    example: 120,
    description: 'Текущее количество детали на складе (кэш журнала движений)',
  })
  quantity!: number;

  @ApiPropertyOptional({
    example: '7b8f9e10-1234-4567-89ab-cdef01234567',
    description: 'ID категории детали',
    nullable: true,
  })
  categoryId?: string | null;

  @ApiPropertyOptional({
    type: () => CategoryResponseDto,
    description: 'Категория детали',
    nullable: true,
  })
  category?: CategoryResponseDto | null;

  @ApiPropertyOptional({
    type: () => [Tag],
    description: 'Теги / метки детали',
  })
  tags?: Tag[];

  @ApiProperty({
    example: { nominal_voltage: 12, package_type: 'smd_0805' },
    description: 'Денормализованный снимок всех атрибутов для быстрого поиска',
  })
  attributesSnapshot!: Record<string, unknown>;

  @ApiProperty({
    example: '2026-09-24T10:00:00.000Z',
    description: 'Дата создания',
  })
  createdAt!: Date;

  @ApiProperty({
    example: '2026-09-24T10:00:00.000Z',
    description: 'Дата обновления',
  })
  updatedAt!: Date;
}

export class PaginatedPartsResponseDto extends PaginatedResponseDto<PartDto> {
  @ApiProperty({
    type: () => [PartDto],
    description: 'Список деталей',
  })
  declare data: PartDto[];
}
