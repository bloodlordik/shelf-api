import { Injectable } from '@nestjs/common';
import { PartsService } from '../parts/services/parts.service';
import { PartsFilterService } from '../parts/services/parts-filter.service';
import { CategoriesService } from '../categories/categories.service';
import { TagsService } from '../tags/tags.service';
import { AttributeDefinitionsService } from '../attributes/services/attributes-definition.service';
import { UnitsService } from '../units/units.service';
import { StockMovementsService } from '../stock/services/stock-movements.service';
import {
  AdminStatsResponseDto,
  LowStockPartSummaryDto,
} from './dto/admin-stats.dto';
import { PartFilterDto } from '../parts/dto/part-filter.dto';
import { GlobalStockMovementFilterDto } from '../stock/dto/global-stock-movement-filter.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly partsService: PartsService,
    private readonly partsFilterService: PartsFilterService,
    private readonly categoriesService: CategoriesService,
    private readonly tagsService: TagsService,
    private readonly attrDefsService: AttributeDefinitionsService,
    private readonly unitsService: UnitsService,
    private readonly stockMovementsService: StockMovementsService,
  ) {}

  async getStats(): Promise<AdminStatsResponseDto> {
    const lowStockFilter = Object.assign(new PartFilterDto(), {
      page: 1,
      limit: 10,
      maxQuantity: 5,
      sortBy: 'quantity' as const,
      sortOrder: 'ASC' as const,
    });
    const movementFilter = Object.assign(new GlobalStockMovementFilterDto(), {
      page: 1,
      limit: 10,
    });

    const [
      partsSummary,
      categoriesCount,
      tagsCount,
      attributesCount,
      unitsCount,
      movementsRes,
      lowStockPartsRes,
    ] = await Promise.all([
      this.partsService.getSummary(),
      this.categoriesService.count(),
      this.tagsService.count(),
      this.attrDefsService.countDefinitions(),
      this.unitsService.count(),
      this.stockMovementsService.getGlobalMovements(movementFilter),
      this.partsFilterService.filterParts(lowStockFilter),
    ]);

    const lowStockParts: LowStockPartSummaryDto[] = lowStockPartsRes.data.map(
      (p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        quantity: p.quantity,
        categoryName: p.category?.name ?? null,
      }),
    );

    return {
      totalParts: partsSummary.totalParts,
      totalQuantity: partsSummary.totalQuantity,
      lowStockCount: partsSummary.lowStockCount,
      outOfStockCount: partsSummary.outOfStockCount,
      categoriesCount,
      tagsCount,
      attributesCount,
      unitsCount,
      movementsCount: movementsRes.meta.total,
      recentMovements: movementsRes.data,
      lowStockParts,
    };
  }
}
