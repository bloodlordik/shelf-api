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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { Tag } from './entities/tag.entity';

@ApiTags('tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  @ApiOperation({ summary: 'Создать новый тег' })
  @ApiResponse({ status: 201, description: 'Тег успешно создан', type: Tag })
  @ApiResponse({
    status: 409,
    description: 'Тег с таким именем уже существует',
  })
  create(@Body() createTagDto: CreateTagDto): Promise<Tag> {
    return this.tagsService.create(createTagDto);
  }

  @Get()
  @ApiOperation({ summary: 'Получить список тегов (поиск по части имени)' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Поиск по имени тега',
  })
  @ApiResponse({ status: 200, description: 'Список тегов', type: [Tag] })
  findAll(@Query('search') search?: string): Promise<Tag[]> {
    return this.tagsService.findAll(search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить тег по ID' })
  @ApiParam({ name: 'id', description: 'UUID тега' })
  @ApiResponse({ status: 200, description: 'Тег', type: Tag })
  @ApiResponse({ status: 404, description: 'Тег не найден' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Tag> {
    return this.tagsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить тег' })
  @ApiParam({ name: 'id', description: 'UUID тега' })
  @ApiResponse({ status: 200, description: 'Обновленный тег', type: Tag })
  @ApiResponse({ status: 404, description: 'Тег не найден' })
  @ApiResponse({
    status: 409,
    description: 'Тег с таким именем уже существует',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTagDto: UpdateTagDto,
  ): Promise<Tag> {
    return this.tagsService.update(id, updateTagDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить тег' })
  @ApiParam({ name: 'id', description: 'UUID тега' })
  @ApiResponse({ status: 204, description: 'Тег успешно удален' })
  @ApiResponse({ status: 404, description: 'Тег не найден' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.tagsService.remove(id);
  }
}
