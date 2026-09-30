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
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { Part } from '../parts/entities/part.entity';
import { StockMovementResponseDto } from '../stock/dto/stock-movement-response.dto';
import { Category } from '../categories/entities/category.entity';
import { Tag } from '../tags/entities/tag.entity';
import { AttributeDefinition } from '../attributes/entities/attribute-definition.entity';
import { Unit } from '../units/entities/unit.entity';

describe('AdminService', () => {
  let service: AdminService;

  let partsServiceMock: { getSummary: jest.Mock };
  let partsFilterServiceMock: { filterParts: jest.Mock };
  let categoriesServiceMock: { findAll: jest.Mock };
  let tagsServiceMock: { findAll: jest.Mock };
  let attrDefsServiceMock: { findAllDefinitions: jest.Mock };
  let unitsServiceMock: { findAll: jest.Mock };
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
      filterParts: jest.fn().mockResolvedValue(
        new PaginatedResponseDto<Part>(
          [
            {
              id: 'p-1',
              name: 'Resistor 10k',
              sku: 'RES-10K',
              quantity: 2,
              category: { id: 'c-1', name: 'Resistors' } as Category,
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
          2,
          1,
          10,
        ),
      ),
    };

    categoriesServiceMock = {
      findAll: jest
        .fn()
        .mockResolvedValue(new PaginatedResponseDto<Category>([], 4, 1, 1)),
    };

    tagsServiceMock = {
      findAll: jest.fn().mockResolvedValue([
        { id: 't-1', name: 'SMD' },
        { id: 't-2', name: 'DIP' },
        { id: 't-3', name: '0805' },
        { id: 't-4', name: '0603' },
        { id: 't-5', name: 'Passives' },
        { id: 't-6', name: 'Actives' },
      ] as Tag[]),
    };

    attrDefsServiceMock = {
      findAllDefinitions: jest
        .fn()
        .mockResolvedValue(
          new Array(8).fill({ id: 'attr' }) as AttributeDefinition[],
        ),
    };

    unitsServiceMock = {
      findAll: jest
        .fn()
        .mockResolvedValue(new Array(5).fill({ id: 'unit' }) as Unit[]),
    };

    stockMovementsServiceMock = {
      getGlobalMovements: jest.fn().mockResolvedValue(
        new PaginatedResponseDto<StockMovementResponseDto>(
          [
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
          22,
          1,
          10,
        ),
      ),
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
