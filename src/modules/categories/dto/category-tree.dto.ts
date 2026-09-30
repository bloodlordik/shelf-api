import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryBreadcrumbDto {
  @ApiProperty({ example: '7b8f9e10-1234-4567-89ab-cdef01234567' })
  id!: string;

  @ApiProperty({ example: 'Пассивные компоненты' })
  name!: string;

  @ApiPropertyOptional({ example: 'passives' })
  code?: string | null;
}

export class CategoryTreeDto {
  @ApiProperty({ example: '7b8f9e10-1234-4567-89ab-cdef01234567' })
  id!: string;

  @ApiProperty({ example: 'Пассивные компоненты' })
  name!: string;

  @ApiPropertyOptional({ example: 'passives' })
  code?: string | null;

  @ApiPropertyOptional({ example: null })
  parentId?: string | null;

  @ApiProperty({ type: [CategoryTreeDto], description: 'Дочерние категории' })
  children!: CategoryTreeDto[];

  @ApiProperty({ example: '2026-09-24T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-09-24T10:00:00.000Z' })
  updatedAt!: Date;
}
