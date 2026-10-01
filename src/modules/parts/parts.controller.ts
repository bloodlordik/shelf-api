import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  Query,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PartsService } from './services/parts.service';
import { PartsCardFacade } from './services/parts-card.facade';
import { PartsFilterService } from './services/parts-filter.service';
import { StockMovementsService } from '../stock/services/stock-movements.service';
import { AttributeHistoryService } from '../attributes/services/attribute-history.service';
import { CreatePartDto } from './dto/create-part.dto';
import { UpdatePartDto } from './dto/update-part.dto';
import { ReplacePartAttributesDto } from './dto/replace-part-attributes.dto';
import { PartFilterDto } from './dto/part-filter.dto';
import { PartsSummaryDto } from './dto/parts-summary.dto';
import { PartCardResponseDto } from './dto/part-card-response.dto';
import { CreateStockMovementDto } from '../stock/dto/create-stock-movement.dto';
import { StockMovementFilterDto } from '../stock/dto/stock-movement-filter.dto';
import { StockMovementResponseDto } from '../stock/dto/stock-movement-response.dto';
import { AttributeHistoryFilterDto } from '../attributes/dto/attribute-history-filter.dto';
import { AttributeValueHistoryResponseDto } from '../attributes/dto/attribute-value-history-response.dto';
import { Part } from './entities/part.entity';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

@ApiTags('parts')
@Controller('parts')
export class PartsController {
  constructor(
    private readonly partsService: PartsService,
    private readonly partsCardFacade: PartsCardFacade,
    private readonly partsFilterService: PartsFilterService,
    private readonly stockMovementsService: StockMovementsService,
    private readonly attributeHistoryService: AttributeHistoryService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Создать новую деталь со связями и динамическими атрибутами',
  })
  @ApiResponse({
    status: 201,
    description: 'Деталь успешно создана',
    type: Part,
  })
  @ApiResponse({
    status: 400,
    description: 'Ошибка валидации основных полей',
  })
  @ApiResponse({
    status: 422,
    description: 'Ошибка валидации динамических EAV-атрибутов',
  })
  @ApiResponse({
    status: 409,
    description: 'Деталь с таким SKU уже существует',
  })
  create(@Body() createPartDto: CreatePartDto): Promise<Part> {
    return this.partsService.create(createPartDto);
  }

  @Get()
  @ApiOperation({
    summary:
      'Поиск и фильтрация деталей (по категории, тегам AND, атрибутам EAV/JSONB)',
  })
  @ApiResponse({ status: 200, description: 'Список деталей с пагинацией' })
  findAll(
    @Query() filterDto: PartFilterDto,
    @Req() req: Request,
  ): Promise<PaginatedResponseDto<Part>> {
    return this.partsFilterService.filterParts(filterDto, req.query);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Получить сводную статистику по номенклатуре и остаткам',
  })
  @ApiResponse({
    status: 200,
    description: 'Сводная статистика по деталям',
    type: PartsSummaryDto,
  })
  getSummary(): Promise<PartsSummaryDto> {
    return this.partsService.getSummary();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить базовую информацию о детали по ID' })
  @ApiParam({ name: 'id', description: 'UUID детали' })
  @ApiResponse({ status: 200, description: 'Деталь', type: Part })
  @ApiResponse({ status: 404, description: 'Деталь не найдена' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Part> {
    return this.partsService.findOne(id);
  }

  @Get(':id/card')
  @ApiOperation({
    summary:
      'Получить полную карточку детали (с хлебными крошками, единицами измерения, лейблами опций)',
  })
  @ApiParam({ name: 'id', description: 'UUID детали' })
  @ApiResponse({
    status: 200,
    description: 'Полная карточка детали',
    type: PartCardResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Деталь не найдена' })
  getCard(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PartCardResponseDto> {
    return this.partsCardFacade.getPartCard(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Частично обновить деталь и/или атрибуты' })
  @ApiParam({ name: 'id', description: 'UUID детали' })
  @ApiResponse({ status: 200, description: 'Обновленная деталь', type: Part })
  @ApiResponse({ status: 400, description: 'Ошибка валидации основных полей' })
  @ApiResponse({
    status: 422,
    description: 'Ошибка валидации динамических EAV-атрибутов',
  })
  @ApiResponse({ status: 404, description: 'Деталь не найдена' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePartDto: UpdatePartDto,
  ): Promise<Part> {
    return this.partsService.update(id, updatePartDto);
  }

  @Put(':id/attributes')
  @ApiOperation({
    summary: 'Полностью перезаписать все динамические атрибуты детали',
  })
  @ApiParam({ name: 'id', description: 'UUID детали' })
  @ApiResponse({
    status: 200,
    description: 'Деталь с обновленными атрибутами',
    type: Part,
  })
  @ApiResponse({
    status: 400,
    description: 'Ошибка валидации тела запроса',
  })
  @ApiResponse({
    status: 422,
    description: 'Ошибка валидации динамических EAV-атрибутов',
  })
  @ApiResponse({ status: 404, description: 'Деталь не найдена' })
  replaceAttributes(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplacePartAttributesDto,
  ): Promise<Part> {
    return this.partsService.replaceAttributes(id, dto);
  }

  @Post(':id/movements')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Зафиксировать складское движение для детали',
  })
  @ApiParam({ name: 'id', description: 'UUID детали' })
  @ApiResponse({
    status: 201,
    description: 'Складское движение успешно сохранено',
    type: StockMovementResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Ошибка валидации или недостаточно остатка',
  })
  @ApiResponse({ status: 404, description: 'Деталь не найдена' })
  applyMovement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateStockMovementDto,
  ): Promise<StockMovementResponseDto> {
    return this.stockMovementsService.applyMovement(id, dto);
  }

  @Get(':id/movements')
  @ApiOperation({
    summary: 'Получить историю складских движений по детали',
  })
  @ApiParam({ name: 'id', description: 'UUID детали' })
  @ApiResponse({
    status: 200,
    description: 'Пагинированный список движений по детали',
    type: PaginatedResponseDto<StockMovementResponseDto>,
  })
  @ApiResponse({ status: 404, description: 'Деталь не найдена' })
  getMovements(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filterDto: StockMovementFilterDto,
  ): Promise<PaginatedResponseDto<StockMovementResponseDto>> {
    return this.stockMovementsService.getPartMovements(id, filterDto);
  }

  @Get(':id/attributes/history')
  @ApiOperation({
    summary: 'Получить историю изменений динамических атрибутов детали',
  })
  @ApiParam({ name: 'id', description: 'UUID детали' })
  @ApiResponse({
    status: 200,
    description: 'Пагинированная история изменений атрибутов детали',
    type: PaginatedResponseDto<AttributeValueHistoryResponseDto>,
  })
  @ApiResponse({ status: 404, description: 'Деталь не найдена' })
  getAttributeHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filterDto: AttributeHistoryFilterDto,
  ): Promise<PaginatedResponseDto<AttributeValueHistoryResponseDto>> {
    return this.attributeHistoryService.getHistoryByPart(id, filterDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Удалить деталь (каскадное удаление значений атрибутов и тегов)',
  })
  @ApiParam({ name: 'id', description: 'UUID детали' })
  @ApiResponse({ status: 204, description: 'Деталь успешно удалена' })
  @ApiResponse({ status: 404, description: 'Деталь не найдена' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.partsService.remove(id);
  }
}
