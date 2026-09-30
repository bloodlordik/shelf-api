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
