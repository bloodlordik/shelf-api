import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { StockMovementsService } from './services/stock-movements.service';
import { GlobalStockMovementFilterDto } from './dto/global-stock-movement-filter.dto';
import {
  StockMovementResponseDto,
  PaginatedStockMovementsResponseDto,
} from './dto/stock-movement-response.dto';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { DomainException } from '../../common/exceptions/domain.exception';

export class GlobalCreateStockMovementDto extends CreateStockMovementDto {
  @ApiPropertyOptional({
    description: 'UUID детали',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  partId?: string;
}

@ApiTags('stock')
@Controller('stock')
export class StockMovementsController {
  constructor(private readonly stockMovementsService: StockMovementsService) {}

  @Get('movements')
  @ApiOperation({
    summary: 'Глобальный журнал складских движений по всем деталям',
  })
  @ApiResponse({
    status: 200,
    description: 'Пагинированный список складских движений',
    type: PaginatedStockMovementsResponseDto,
  })
  getGlobalMovements(
    @Query() filterDto: GlobalStockMovementFilterDto,
  ): Promise<PaginatedResponseDto<StockMovementResponseDto>> {
    return this.stockMovementsService.getGlobalMovements(filterDto);
  }

  @Post('movements')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Создание складского движения (при наличии partId в теле)',
  })
  @ApiResponse({
    status: 201,
    description: 'Движение успешно зафиксировано',
    type: StockMovementResponseDto,
  })
  createMovement(
    @Body() dto: GlobalCreateStockMovementDto,
  ): Promise<StockMovementResponseDto> {
    if (!dto.partId) {
      throw new DomainException(
        'partId is required when creating movement via /stock/movements',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.stockMovementsService.applyMovement(dto.partId, dto);
  }
}
