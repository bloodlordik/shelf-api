import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryTreeDto } from './dto/category-tree.dto';
import {
  CategoryDetailResponseDto,
  PaginatedCategoriesResponseDto,
} from './dto/category-response.dto';
import { Category } from './entities/category.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Создать новую категорию' })
  @ApiResponse({
    status: 201,
    description: 'Категория успешно создана',
    type: Category,
  })
  create(@Body() createCategoryDto: CreateCategoryDto): Promise<Category> {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get('tree')
  @ApiOperation({ summary: 'Получить иерархическое дерево категорий' })
  @ApiResponse({
    status: 200,
    description: 'Дерево категорий',
    type: [CategoryTreeDto],
  })
  getTree(): Promise<CategoryTreeDto[]> {
    return this.categoriesService.getTree();
  }

  @Get()
  @ApiOperation({ summary: 'Получить плоский список категорий с пагинацией' })
  @ApiResponse({
    status: 200,
    description: 'Список категорий с пагинацией',
    type: PaginatedCategoriesResponseDto,
  })
  findAll(
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<Category>> {
    return this.categoriesService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить категорию по ID с хлебными крошками' })
  @ApiParam({ name: 'id', description: 'UUID категории' })
  @ApiResponse({
    status: 200,
    description: 'Детальная информация о категории',
    type: CategoryDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Категория не найдена' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CategoryDetailResponseDto> {
    return this.categoriesService.getCategoryDetail(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Обновить категорию (с защитой от циклов в иерархии)',
  })
  @ApiParam({ name: 'id', description: 'UUID категории' })
  @ApiResponse({
    status: 200,
    description: 'Обновленная категория',
    type: Category,
  })
  @ApiResponse({
    status: 400,
    description: 'Некорректные параметры или обнаружен цикл',
  })
  @ApiResponse({ status: 404, description: 'Категория не найдена' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить категорию' })
  @ApiParam({ name: 'id', description: 'UUID категории' })
  @ApiResponse({ status: 204, description: 'Категория успешно удалена' })
  @ApiResponse({
    status: 400,
    description: 'Невозможно удалить: есть дочерние элементы',
  })
  @ApiResponse({ status: 404, description: 'Категория не найдена' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categoriesService.remove(id);
  }
}
