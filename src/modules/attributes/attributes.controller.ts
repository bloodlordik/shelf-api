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
import { AttributeDefinitionsService } from './services/attributes-definition.service';
import { CreateAttributeDefinitionDto } from './dto/create-attribute-definition.dto';
import { UpdateAttributeDefinitionDto } from './dto/update-attribute-definition.dto';
import { CreateAttributeOptionDto } from './dto/create-attribute-option.dto';
import { UpdateAttributeOptionDto } from './dto/update-attribute-option.dto';
import { AttributeDefinition } from './entities/attribute-definition.entity';
import { AttributeOption } from './entities/attribute-option.entity';
import { AttributeHistoryService } from './services/attribute-history.service';
import { AttributeHistoryFilterDto } from './dto/attribute-history-filter.dto';
import { AttributeValueHistoryResponseDto } from './dto/attribute-value-history-response.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

@ApiTags('attributes')
@Controller('attributes')
export class AttributesController {
  constructor(
    private readonly attributeDefinitionsService: AttributeDefinitionsService,
    private readonly attributeHistoryService: AttributeHistoryService,
  ) {}

  @Post('definitions')
  @ApiOperation({ summary: 'Создать новое определение динамического атрибута' })
  @ApiResponse({
    status: 201,
    description: 'Определение атрибута успешно создано',
    type: AttributeDefinition,
  })
  @ApiResponse({
    status: 409,
    description: 'Атрибут с таким ключом уже существует',
  })
  createDefinition(
    @Body() createDto: CreateAttributeDefinitionDto,
  ): Promise<AttributeDefinition> {
    return this.attributeDefinitionsService.createDefinition(createDto);
  }

  @Get('definitions')
  @ApiOperation({ summary: 'Получить список всех определений атрибутов' })
  @ApiResponse({
    status: 200,
    description: 'Список определений атрибутов',
    type: [AttributeDefinition],
  })
  findAllDefinitions(): Promise<AttributeDefinition[]> {
    return this.attributeDefinitionsService.findAllDefinitions();
  }

  @Get('definitions/:id')
  @ApiOperation({ summary: 'Получить определение атрибута по ID' })
  @ApiParam({ name: 'id', description: 'UUID определения атрибута' })
  @ApiResponse({
    status: 200,
    description: 'Определение атрибута',
    type: AttributeDefinition,
  })
  @ApiResponse({ status: 404, description: 'Определение атрибута не найдено' })
  findDefinitionById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AttributeDefinition> {
    return this.attributeDefinitionsService.findDefinitionById(id);
  }

  @Patch('definitions/:id')
  @ApiOperation({ summary: 'Обновить метаданные определения атрибута' })
  @ApiParam({ name: 'id', description: 'UUID определения атрибута' })
  @ApiResponse({
    status: 200,
    description: 'Обновленное определение атрибута',
    type: AttributeDefinition,
  })
  @ApiResponse({ status: 404, description: 'Определение атрибута не найдено' })
  updateDefinition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateAttributeDefinitionDto,
  ): Promise<AttributeDefinition> {
    return this.attributeDefinitionsService.updateDefinition(id, updateDto);
  }

  @Delete('definitions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить определение атрибута' })
  @ApiParam({ name: 'id', description: 'UUID определения атрибута' })
  @ApiResponse({
    status: 204,
    description: 'Определение атрибута успешно удалено',
  })
  @ApiResponse({ status: 404, description: 'Определение атрибута не найдено' })
  removeDefinition(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.attributeDefinitionsService.removeDefinition(id);
  }

  // --- Options endpoints ---

  @Post('definitions/:id/options')
  @ApiOperation({
    summary: 'Добавить вариант значения (опцию) к enum/multi_enum атрибуту',
  })
  @ApiParam({ name: 'id', description: 'UUID определения атрибута' })
  @ApiResponse({
    status: 201,
    description: 'Опция успешно создана',
    type: AttributeOption,
  })
  @ApiResponse({
    status: 400,
    description: 'Атрибут не является enum/multi_enum',
  })
  @ApiResponse({
    status: 409,
    description: 'Опция с таким значением уже существует',
  })
  createOption(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createOptionDto: CreateAttributeOptionDto,
  ): Promise<AttributeOption> {
    return this.attributeDefinitionsService.createOption(id, createOptionDto);
  }

  @Patch('options/:optionId')
  @ApiOperation({ summary: 'Обновить вариант значения (опцию)' })
  @ApiParam({ name: 'optionId', description: 'UUID опции' })
  @ApiResponse({
    status: 200,
    description: 'Обновленная опция',
    type: AttributeOption,
  })
  @ApiResponse({ status: 404, description: 'Опция не найдена' })
  updateOption(
    @Param('optionId', ParseUUIDPipe) optionId: string,
    @Body() updateOptionDto: UpdateAttributeOptionDto,
  ): Promise<AttributeOption> {
    return this.attributeDefinitionsService.updateOption(
      optionId,
      updateOptionDto,
    );
  }

  @Delete('options/:optionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить вариант значения (опцию)' })
  @ApiParam({ name: 'optionId', description: 'UUID опции' })
  @ApiResponse({ status: 204, description: 'Опция успешно удалена' })
  @ApiResponse({ status: 404, description: 'Опция не найдена' })
  removeOption(
    @Param('optionId', ParseUUIDPipe) optionId: string,
  ): Promise<void> {
    return this.attributeDefinitionsService.removeOption(optionId);
  }

  @Get(':id/history')
  @ApiOperation({
    summary: 'История изменений конкретного атрибута по всем деталям',
  })
  @ApiParam({ name: 'id', description: 'UUID определения атрибута' })
  @ApiResponse({
    status: 200,
    description: 'Пагинированная история изменений атрибута',
    type: PaginatedResponseDto<AttributeValueHistoryResponseDto>,
  })
  getDefinitionHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filterDto: AttributeHistoryFilterDto,
  ): Promise<PaginatedResponseDto<AttributeValueHistoryResponseDto>> {
    return this.attributeHistoryService.getHistoryByDefinition(id, filterDto);
  }
}
