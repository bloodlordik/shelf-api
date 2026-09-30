import { Injectable, NotFoundException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { StockMovement } from '../entities/stock-movement.entity';
import { Part } from '../../parts/entities/part.entity';
import { ActorsService } from '../../actors/services/actors.service';
import { StockMovementType } from '../enums/stock-movement-type.enum';
import { CreateStockMovementDto } from '../dto/create-stock-movement.dto';
import { StockMovementFilterDto } from '../dto/stock-movement-filter.dto';
import { GlobalStockMovementFilterDto } from '../dto/global-stock-movement-filter.dto';
import { StockMovementResponseDto } from '../dto/stock-movement-response.dto';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { DomainException } from '../../../common/exceptions/domain.exception';

@Injectable()
export class StockMovementsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(StockMovement)
    private readonly stockMovementRepository: Repository<StockMovement>,
    @InjectRepository(Part)
    private readonly partRepository: Repository<Part>,
    private readonly actorsService: ActorsService,
  ) {}

  /**
   * Единственная точка входа для изменения количества детали на складе.
   * Выполняет пессимистическую блокировку детали, авторегистрацию актора,
   * проверку бизнес-инвариантов и атомарное сохранение движения и кэша quantity.
   */
  async applyMovement(
    partId: string,
    input: CreateStockMovementDto,
    manager?: EntityManager,
  ): Promise<StockMovement> {
    if (!input.actorId || input.actorId < 1) {
      throw new DomainException(
        'actorId must be a positive integer',
        HttpStatus.BAD_REQUEST,
      );
    }

    const executeInTx = async (txManager: EntityManager) => {
      // 1. Гарантируем наличие актора
      await this.actorsService.ensureActorExists(input.actorId, txManager);

      // 2. Пессимистическая блокировка строки детали
      const part = await txManager
        .getRepository(Part)
        .createQueryBuilder('part')
        .setLock('pessimistic_write')
        .where('part.id = :id', { id: partId })
        .getOne();

      if (!part) {
        throw new NotFoundException(`Part with ID "${partId}" not found`);
      }

      // 3. Расчёт дельты и валидация полей по типу движения
      let calculatedDelta: number;

      switch (input.type) {
        case StockMovementType.RECEIPT: {
          if (!input.referenceDoc || input.referenceDoc.trim() === '') {
            throw new DomainException(
              'referenceDoc is required for receipt movement',
              HttpStatus.BAD_REQUEST,
            );
          }
          if (!input.quantity || input.quantity <= 0) {
            throw new DomainException(
              'quantity must be greater than 0 for receipt movement',
              HttpStatus.BAD_REQUEST,
            );
          }
          calculatedDelta = input.quantity;
          break;
        }

        case StockMovementType.WRITEOFF: {
          if (!input.reason || input.reason.trim() === '') {
            throw new DomainException(
              'reason is required for writeoff movement',
              HttpStatus.BAD_REQUEST,
            );
          }
          if (!input.quantity || input.quantity <= 0) {
            throw new DomainException(
              'quantity must be greater than 0 for writeoff movement',
              HttpStatus.BAD_REQUEST,
            );
          }
          calculatedDelta = -input.quantity;
          break;
        }

        case StockMovementType.CORRECTION: {
          if (!input.reason || input.reason.trim() === '') {
            throw new DomainException(
              'reason is required for correction movement',
              HttpStatus.BAD_REQUEST,
            );
          }
          if (input.targetQuantity !== undefined) {
            calculatedDelta = input.targetQuantity - part.quantity;
          } else if (input.quantity !== undefined) {
            calculatedDelta = input.quantity;
          } else {
            throw new DomainException(
              'Either targetQuantity or quantity must be provided for correction movement',
              HttpStatus.BAD_REQUEST,
            );
          }

          if (calculatedDelta === 0) {
            throw new DomainException(
              'Correction delta is 0; current quantity already matches target quantity',
              HttpStatus.BAD_REQUEST,
              {
                currentQuantity: part.quantity,
                targetQuantity: input.targetQuantity,
              },
            );
          }
          break;
        }

        case StockMovementType.TRANSFER_OUT: {
          if (
            (!input.reason || input.reason.trim() === '') &&
            (!input.referenceDoc || input.referenceDoc.trim() === '')
          ) {
            throw new DomainException(
              'reason or referenceDoc is required for transfer_out movement',
              HttpStatus.BAD_REQUEST,
            );
          }
          if (!input.quantity || input.quantity <= 0) {
            throw new DomainException(
              'quantity must be greater than 0 for transfer_out movement',
              HttpStatus.BAD_REQUEST,
            );
          }
          calculatedDelta = -input.quantity;
          break;
        }

        case StockMovementType.TRANSFER_IN: {
          if (
            (!input.reason || input.reason.trim() === '') &&
            (!input.referenceDoc || input.referenceDoc.trim() === '')
          ) {
            throw new DomainException(
              'reason or referenceDoc is required for transfer_in movement',
              HttpStatus.BAD_REQUEST,
            );
          }
          if (!input.quantity || input.quantity <= 0) {
            throw new DomainException(
              'quantity must be greater than 0 for transfer_in movement',
              HttpStatus.BAD_REQUEST,
            );
          }
          calculatedDelta = input.quantity;
          break;
        }

        default:
          throw new DomainException(
            `Unsupported movement type: ${String(input.type)}`,
            HttpStatus.BAD_REQUEST,
          );
      }

      // 4. Проверка инварианта неотрицательного остатка
      const currentQuantity = part.quantity;
      const newQuantity = currentQuantity + calculatedDelta;

      if (newQuantity < 0) {
        throw new DomainException(
          `Insufficient stock for part "${part.sku}". Current: ${currentQuantity}, requested delta: ${calculatedDelta}`,
          HttpStatus.BAD_REQUEST,
          { partId, currentQuantity, requestedDelta: calculatedDelta },
        );
      }

      // 5. Создание и сохранение записи движения
      const movement = txManager.create(StockMovement, {
        partId,
        movementType: input.type,
        quantityDelta: calculatedDelta,
        quantityAfter: newQuantity,
        reason: input.reason ? input.reason.trim() : null,
        referenceDoc: input.referenceDoc ? input.referenceDoc.trim() : null,
        performedBy: input.actorId,
      });
      const savedMovement = await txManager.save(StockMovement, movement);

      // 6. Обновление денормализованного кэша в Part
      part.quantity = newQuantity;
      await txManager.save(Part, part);

      return savedMovement;
    };

    if (manager) {
      return executeInTx(manager);
    }
    return this.dataSource.transaction(executeInTx);
  }

  /**
   * Получение движений по конкретной детали с фильтрацией и пагинацией.
   */
  async getPartMovements(
    partId: string,
    filterDto: StockMovementFilterDto,
  ): Promise<PaginatedResponseDto<StockMovementResponseDto>> {
    const part = await this.partRepository.findOne({ where: { id: partId } });
    if (!part) {
      throw new NotFoundException(`Part with ID "${partId}" not found`);
    }

    const qb = this.stockMovementRepository
      .createQueryBuilder('sm')
      .where('sm.partId = :partId', { partId });

    if (filterDto.type) {
      qb.andWhere('sm.movementType = :type', { type: filterDto.type });
    }
    if (filterDto.fromDate) {
      qb.andWhere('sm.performedAt >= :fromDate', {
        fromDate: new Date(filterDto.fromDate),
      });
    }
    if (filterDto.toDate) {
      qb.andWhere('sm.performedAt <= :toDate', {
        toDate: new Date(filterDto.toDate),
      });
    }
    if (filterDto.performedBy) {
      qb.andWhere('sm.performedBy = :performedBy', {
        performedBy: filterDto.performedBy,
      });
    }

    qb.orderBy('sm.performedAt', 'DESC').addOrderBy('sm.id', 'DESC');

    const total = await qb.getCount();
    const items = await qb.skip(filterDto.skip).take(filterDto.limit).getMany();

    const dtos: StockMovementResponseDto[] = items.map((m) => ({
      id: m.id,
      partId: m.partId,
      partSku: part.sku,
      partName: part.name,
      movementType: m.movementType,
      quantityDelta: m.quantityDelta,
      quantityAfter: m.quantityAfter,
      reason: m.reason,
      referenceDoc: m.referenceDoc,
      performedBy: m.performedBy,
      performedAt: m.performedAt,
    }));

    return new PaginatedResponseDto(
      dtos,
      total,
      filterDto.page,
      filterDto.limit,
    );
  }

  /**
   * Получение глобального журнала движений по складу.
   */
  async getGlobalMovements(
    filterDto: GlobalStockMovementFilterDto,
  ): Promise<PaginatedResponseDto<StockMovementResponseDto>> {
    const qb = this.stockMovementRepository
      .createQueryBuilder('sm')
      .leftJoinAndSelect('sm.part', 'part');

    if (filterDto.partId) {
      qb.andWhere('sm.partId = :partId', { partId: filterDto.partId });
    }
    if (filterDto.sku) {
      qb.andWhere('part.sku ILIKE :sku', { sku: `%${filterDto.sku}%` });
    }
    if (filterDto.type) {
      qb.andWhere('sm.movementType = :type', { type: filterDto.type });
    }
    if (filterDto.fromDate) {
      qb.andWhere('sm.performedAt >= :fromDate', {
        fromDate: new Date(filterDto.fromDate),
      });
    }
    if (filterDto.toDate) {
      qb.andWhere('sm.performedAt <= :toDate', {
        toDate: new Date(filterDto.toDate),
      });
    }
    if (filterDto.performedBy) {
      qb.andWhere('sm.performedBy = :performedBy', {
        performedBy: filterDto.performedBy,
      });
    }

    qb.orderBy('sm.performedAt', 'DESC').addOrderBy('sm.id', 'DESC');

    const total = await qb.getCount();
    const items = await qb.skip(filterDto.skip).take(filterDto.limit).getMany();

    const dtos: StockMovementResponseDto[] = items.map((m) => ({
      id: m.id,
      partId: m.partId,
      partSku: m.part?.sku,
      partName: m.part?.name,
      movementType: m.movementType,
      quantityDelta: m.quantityDelta,
      quantityAfter: m.quantityAfter,
      reason: m.reason,
      referenceDoc: m.referenceDoc,
      performedBy: m.performedBy,
      performedAt: m.performedAt,
    }));

    return new PaginatedResponseDto(
      dtos,
      total,
      filterDto.page,
      filterDto.limit,
    );
  }

  /**
   * Получение сводной информации о движениях детали (последнее движение, общее количество).
   */
  async getPartStockSummary(
    partId: string,
    manager?: EntityManager,
  ): Promise<{ lastMovementAt: Date | null; totalMovementsCount: number }> {
    const repo = manager
      ? manager.getRepository(StockMovement)
      : this.stockMovementRepository;

    const count = await repo.count({ where: { partId } });
    const latest = await repo.findOne({
      where: { partId },
      order: { performedAt: 'DESC' },
    });

    return {
      lastMovementAt: latest?.performedAt || null,
      totalMovementsCount: count,
    };
  }
}
