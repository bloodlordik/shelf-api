import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryBreadcrumbDto } from './category-tree.dto';

export class CategoryDetailResponseDto {
  @ApiProperty({ example: '7b8f9e10-1234-4567-89ab-cdef01234567' })
  id!: string;

  @ApiProperty({ example: 'Резисторы SMD' })
  name!: string;

  @ApiPropertyOptional({ example: 'resistors_smd' })
  code?: string | null;

  @ApiPropertyOptional({ example: 'parent-uuid' })
  parentId?: string | null;

  @ApiProperty({
    type: [CategoryBreadcrumbDto],
    description: 'Цепочка родителей от корня до текущей категории',
  })
  breadcrumbs!: CategoryBreadcrumbDto[];

  @ApiProperty({ example: '2026-09-24T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-09-24T10:00:00.000Z' })
  updatedAt!: Date;
}

export class CategoryResponseDto {
  @ApiProperty({
    example: '7b8f9e10-1234-4567-89ab-cdef01234567',
    description: 'UUID категории',
  })
  id!: string;

  @ApiProperty({
    example: 'Резисторы SMD',
    description: 'Название категории',
  })
  name!: string;

  @ApiPropertyOptional({
    example: 'resistors_smd',
    description: 'Уникальный код категории',
    nullable: true,
  })
  code?: string | null;

  @ApiPropertyOptional({
    example: 'parent-uuid',
    description: 'ID родительской категории',
    nullable: true,
  })
  parentId?: string | null;

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

export class PaginatedCategoriesResponseDto extends PaginatedResponseDto<CategoryResponseDto> {
  @ApiProperty({
    type: () => [CategoryResponseDto],
    description: 'Список категорий',
  })
  declare data: CategoryResponseDto[];
}
