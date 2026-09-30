import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { StockMovementsService } from './stock-movements.service';
import { StockMovement } from '../entities/stock-movement.entity';
import { Part } from '../../parts/entities/part.entity';
import { ActorsService } from '../../actors/services/actors.service';
import { StockMovementType } from '../enums/stock-movement-type.enum';
import { DomainException } from '../../../common/exceptions/domain.exception';

describe('StockMovementsService', () => {
  let service: StockMovementsService;
  let mockActorsService: { ensureActorExists: jest.Mock };
  let mockPart: Part;
  let mockTxManager: Partial<EntityManager>;

  beforeEach(async () => {
    mockPart = {
      id: 'part-uuid-1',
      sku: 'RES-0805-10K',
      name: 'Резистор SMD',
      quantity: 50,
    } as unknown as Part;

    const mockQueryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest
        .fn()
        .mockImplementation(() => Promise.resolve({ ...mockPart })),
    };

    mockTxManager = {
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      }),
      create: jest
        .fn()
        .mockImplementation(
          (entityClass, data: Partial<StockMovement>): StockMovement => ({
            ...(data as StockMovement),
            id: 'movement-uuid-1',
          }),
        ),
      save: jest
        .fn()
        .mockImplementation((entityClass, entity: StockMovement | Part) => {
          if (entityClass === StockMovement) {
            return Promise.resolve(entity as StockMovement);
          }
          if (entityClass === Part) {
            mockPart.quantity = (entity as Part).quantity;
            return Promise.resolve(entity as Part);
          }
          return Promise.resolve(entity);
        }),
    };

    const mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation(
          (cb: (manager: EntityManager) => Promise<unknown>) =>
            cb(mockTxManager as unknown as EntityManager),
        ),
    };

    mockActorsService = {
      ensureActorExists: jest.fn().mockResolvedValue({ id: 42 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockMovementsService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: getRepositoryToken(StockMovement),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Part),
          useValue: {},
        },
        {
          provide: ActorsService,
          useValue: mockActorsService,
        },
      ],
    }).compile();

    service = module.get<StockMovementsService>(StockMovementsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('applyMovement validation & execution', () => {
    it('should reject invalid actorId (<= 0)', async () => {
      await expect(
        service.applyMovement('part-uuid-1', {
          actorId: 0,
          type: StockMovementType.RECEIPT,
          quantity: 10,
          referenceDoc: 'DOC-1',
        }),
      ).rejects.toThrow(DomainException);
    });

    it('should process RECEIPT movement successfully and update stock', async () => {
      mockPart.quantity = 50;

      const movement = await service.applyMovement('part-uuid-1', {
        actorId: 42,
        type: StockMovementType.RECEIPT,
        quantity: 100,
        referenceDoc: 'ТТН-12345',
      });

      expect(mockActorsService.ensureActorExists).toHaveBeenCalledWith(
        42,
        expect.anything(),
      );
      expect(movement.movementType).toBe(StockMovementType.RECEIPT);
      expect(movement.quantityDelta).toBe(100);
      expect(movement.quantityAfter).toBe(150);
      expect(movement.referenceDoc).toBe('ТТН-12345');
    });

    it('should reject RECEIPT without referenceDoc', async () => {
      await expect(
        service.applyMovement('part-uuid-1', {
          actorId: 42,
          type: StockMovementType.RECEIPT,
          quantity: 100,
        }),
      ).rejects.toThrow(DomainException);
    });

    it('should process WRITEOFF movement and decrease stock', async () => {
      mockPart.quantity = 50;

      const movement = await service.applyMovement('part-uuid-1', {
        actorId: 42,
        type: StockMovementType.WRITEOFF,
        quantity: 20,
        reason: 'Брак при монтаже',
      });

      expect(movement.quantityDelta).toBe(-20);
      expect(movement.quantityAfter).toBe(30);
      expect(movement.reason).toBe('Брак при монтаже');
    });

    it('should reject WRITEOFF without reason', async () => {
      await expect(
        service.applyMovement('part-uuid-1', {
          actorId: 42,
          type: StockMovementType.WRITEOFF,
          quantity: 20,
        }),
      ).rejects.toThrow(DomainException);
    });

    it('should reject WRITEOFF when stock is insufficient (quantity_after < 0)', async () => {
      mockPart.quantity = 10;

      await expect(
        service.applyMovement('part-uuid-1', {
          actorId: 42,
          type: StockMovementType.WRITEOFF,
          quantity: 50,
          reason: 'Расход',
        }),
      ).rejects.toThrow(DomainException);
    });

    it('should process CORRECTION with targetQuantity (increase)', async () => {
      mockPart.quantity = 50;

      const movement = await service.applyMovement('part-uuid-1', {
        actorId: 42,
        type: StockMovementType.CORRECTION,
        targetQuantity: 75,
        reason: 'Акт инвентаризации №1',
      });

      expect(movement.quantityDelta).toBe(25);
      expect(movement.quantityAfter).toBe(75);
    });

    it('should process CORRECTION with targetQuantity (decrease)', async () => {
      mockPart.quantity = 50;

      const movement = await service.applyMovement('part-uuid-1', {
        actorId: 42,
        type: StockMovementType.CORRECTION,
        targetQuantity: 30,
        reason: 'Акт инвентаризации №2',
      });

      expect(movement.quantityDelta).toBe(-20);
      expect(movement.quantityAfter).toBe(30);
    });

    it('should reject CORRECTION when delta is 0', async () => {
      mockPart.quantity = 50;

      await expect(
        service.applyMovement('part-uuid-1', {
          actorId: 42,
          type: StockMovementType.CORRECTION,
          targetQuantity: 50,
          reason: 'Инвентаризация',
        }),
      ).rejects.toThrow(DomainException);
    });

    it('should process TRANSFER_OUT movement', async () => {
      mockPart.quantity = 50;

      const movement = await service.applyMovement('part-uuid-1', {
        actorId: 42,
        type: StockMovementType.TRANSFER_OUT,
        quantity: 15,
        reason: 'Перемещение в цех 2',
      });

      expect(movement.quantityDelta).toBe(-15);
      expect(movement.quantityAfter).toBe(35);
    });

    it('should process TRANSFER_IN movement', async () => {
      mockPart.quantity = 50;

      const movement = await service.applyMovement('part-uuid-1', {
        actorId: 42,
        type: StockMovementType.TRANSFER_IN,
        quantity: 25,
        referenceDoc: 'Накладная перемещения №7',
      });

      expect(movement.quantityDelta).toBe(25);
      expect(movement.quantityAfter).toBe(75);
    });
  });
});
