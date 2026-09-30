import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ example: 1, description: 'Текущая страница' })
  page!: number;

  @ApiProperty({ example: 20, description: 'Количество на странице' })
  limit!: number;

  @ApiProperty({ example: 42, description: 'Общее количество записей' })
  total!: number;

  @ApiProperty({ example: 3, description: 'Всего страниц' })
  totalPages!: number;

  @ApiProperty({ example: true, description: 'Есть ли следующая страница' })
  hasNextPage!: boolean;

  @ApiProperty({ example: false, description: 'Есть ли предыдущая страница' })
  hasPreviousPage!: boolean;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ isArray: true, description: 'Список элементов' })
  data!: T[];

  @ApiProperty({ type: PaginationMetaDto, description: 'Метаданные пагинации' })
  meta!: PaginationMetaDto;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    const totalPages = Math.ceil(total / limit) || 1;
    this.meta = {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}
