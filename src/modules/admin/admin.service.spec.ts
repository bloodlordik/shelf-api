import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PartsService } from '../parts/services/parts.service';
import { PartsFilterService } from '../parts/services/parts-filter.service';
import { CategoriesService } from '../categories/categories.service';
import { TagsService } from '../tags/tags.service';
import { AttributeDefinitionsService } from '../attributes/services/attributes-definition.service';
import { UnitsService } from '../units/units.service';
import { StockMovementsService } from '../stock/services/stock-movements.service';
import { StockMovementType } from '../stock/enums/stock-movement-type.enum';
import { Part } from '../parts/entities/part.entity';

describe('AdminService', () => {
  let service: AdminService;

  let partsServiceMock: { getSummary: jest.Mock };
  let partsFilterServiceMock: { filterParts: jest.Mock };
  let categoriesServiceMock: { count: jest.Mock };
  let tagsServiceMock: { count: jest.Mock };
  let attrDefsServiceMock: { countDefinitions: jest.Mock };
  let unitsServiceMock: { count: jest.Mock };
  let stockMovementsServiceMock: { getGlobalMovements: jest.Mock };

  beforeEach(async () => {
    partsServiceMock = {
      getSummary: jest.fn().mockResolvedValue({
        totalParts: 15,
        totalQuantity: 150,
        lowStockCount: 3,
        outOfStockCount: 1,
      }),
    };

    partsFilterServiceMock = {
      filterParts: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'p-1',
            name: 'Resistor 10k',
            sku: 'RES-10K',
            quantity: 2,
            category: { id: 'c-1', name: 'Resistors' },
            tags: [],
          } as unknown as Part,
          {
            id: 'p-2',
            name: 'Capacitor 100nF',
            sku: 'CAP-100N',
            quantity: 0,
            category: null,
            tags: [],
          } as unknown as Part,
        ],
        meta: {
          total: 2,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      }),
    };

    categoriesServiceMock = {
      count: jest.fn().mockResolvedValue(4),
    };

    tagsServiceMock = {
      count: jest.fn().mockResolvedValue(6),
    };

    attrDefsServiceMock = {
      countDefinitions: jest.fn().mockResolvedValue(8),
    };

    unitsServiceMock = {
      count: jest.fn().mockResolvedValue(5),
    };

    stockMovementsServiceMock = {
      getGlobalMovements: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'm-1',
            partId: 'p-1',
            partSku: 'RES-10K',
            partName: 'Resistor 10k',
            movementType: StockMovementType.RECEIPT,
            quantityDelta: 50,
            quantityAfter: 50,
            reason: 'Initial stock',
            referenceDoc: 'DOC-01',
            performedBy: 1,
            performedAt: new Date('2026-09-30T10:00:00.000Z'),
          },
        ],
        meta: {
          total: 22,
          page: 1,
          limit: 10,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: false,
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PartsService, useValue: partsServiceMock },
        { provide: PartsFilterService, useValue: partsFilterServiceMock },
        { provide: CategoriesService, useValue: categoriesServiceMock },
        { provide: TagsService, useValue: tagsServiceMock },
        {
          provide: AttributeDefinitionsService,
          useValue: attrDefsServiceMock,
        },
        { provide: UnitsService, useValue: unitsServiceMock },
        {
          provide: StockMovementsService,
          useValue: stockMovementsServiceMock,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate stats correctly', async () => {
    const stats = await service.getStats();

    expect(stats.totalParts).toBe(15);
    expect(stats.totalQuantity).toBe(150);
    expect(stats.lowStockCount).toBe(3);
    expect(stats.outOfStockCount).toBe(1);
    expect(stats.categoriesCount).toBe(4);
    expect(stats.tagsCount).toBe(6);
    expect(stats.attributesCount).toBe(8);
    expect(stats.unitsCount).toBe(5);
    expect(stats.movementsCount).toBe(22);
    expect(stats.lowStockParts).toHaveLength(2);
    expect(stats.lowStockParts[0].sku).toBe('RES-10K');
    expect(stats.lowStockParts[0].categoryName).toBe('Resistors');
    expect(stats.recentMovements).toHaveLength(1);
    expect(stats.recentMovements[0].movementType).toBe(
      StockMovementType.RECEIPT,
    );
  });
});
