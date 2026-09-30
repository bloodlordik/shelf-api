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
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { Unit } from './entities/unit.entity';
import { UnitGroup } from './enums/unit-group.enum';

@ApiTags('units')
@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Post()
  @ApiOperation({ summary: 'Создать новую единицу измерения' })
  @ApiResponse({
    status: 201,
    description: 'Единица измерения успешно создана',
    type: Unit,
  })
  create(@Body() createUnitDto: CreateUnitDto): Promise<Unit> {
    return this.unitsService.create(createUnitDto);
  }

  @Get()
  @ApiOperation({ summary: 'Получить список единиц измерения' })
  @ApiQuery({
    name: 'group',
    enum: UnitGroup,
    required: false,
    description: 'Фильтр по группе единиц',
  })
  @ApiResponse({
    status: 200,
    description: 'Список единиц измерения',
    type: [Unit],
  })
  findAll(@Query('group') group?: UnitGroup): Promise<Unit[]> {
    return this.unitsService.findAll(group);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить единицу измерения по ID' })
  @ApiResponse({ status: 200, description: 'Единица измерения', type: Unit })
  @ApiResponse({ status: 404, description: 'Единица измерения не найдена' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Unit> {
    return this.unitsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить единицу измерения' })
  @ApiResponse({
    status: 200,
    description: 'Обновленная единица измерения',
    type: Unit,
  })
  @ApiResponse({ status: 404, description: 'Единица измерения не найдена' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUnitDto: UpdateUnitDto,
  ): Promise<Unit> {
    return this.unitsService.update(id, updateUnitDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить единицу измерения' })
  @ApiResponse({
    status: 204,
    description: 'Единица измерения успешно удалена',
  })
  @ApiResponse({ status: 404, description: 'Единица измерения не найдена' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.unitsService.remove(id);
  }
}
