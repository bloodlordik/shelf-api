import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { AttributeValueHistory } from '../entities/attribute-value-history.entity';
import { AttributeDefinition } from '../entities/attribute-definition.entity';
import { Part } from '../../parts/entities/part.entity';
import { ActorsService } from '../../actors/services/actors.service';
import { AttributeChangeType } from '../enums/attribute-change-type.enum';
import { AttributeHistoryFilterDto } from '../dto/attribute-history-filter.dto';
import { AttributeValueHistoryResponseDto } from '../dto/attribute-value-history-response.dto';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';

interface RawAttributeValueLike {
  attributeDefinitionId: string;
  valueString?: string | null;
  valueNumber?: number | null;
  valueBoolean?: boolean | null;
  valueDate?: Date | null;
  valueOptionId?: string | null;
  valueReferenceId?: string | null;
}

@Injectable()
export class AttributeHistoryService {
  constructor(
    @InjectRepository(AttributeValueHistory)
    private readonly historyRepository: Repository<AttributeValueHistory>,
    @InjectRepository(AttributeDefinition)
    private readonly definitionRepository: Repository<AttributeDefinition>,
    @InjectRepository(Part)
    private readonly partRepository: Repository<Part>,
    private readonly actorsService: ActorsService,
  ) {}

  /**
   * Сравнивает старый и новый списки значений атрибутов и атомарно записывает аудит-лог.
   */
  async recordAttributeDiff(
    partId: string,
    oldValues: RawAttributeValueLike[],
    newValues: RawAttributeValueLike[],
    changedBy: number,
    manager: EntityManager,
  ): Promise<AttributeValueHistory[]> {
    if (!changedBy || changedBy < 1) {
      return [];
    }

    // Гарантируем наличие актора
    await this.actorsService.ensureActorExists(changedBy, manager);

    // Группируем старые и новые значения по attributeDefinitionId
    const oldByDef = new Map<string, RawAttributeValueLike[]>();
    for (const v of oldValues) {
      const list = oldByDef.get(v.attributeDefinitionId) || [];
      list.push(v);
      oldByDef.set(v.attributeDefinitionId, list);
    }

    const newByDef = new Map<string, RawAttributeValueLike[]>();
    for (const v of newValues) {
      const list = newByDef.get(v.attributeDefinitionId) || [];
      list.push(v);
      newByDef.set(v.attributeDefinitionId, list);
    }

    const allDefIds = new Set([...oldByDef.keys(), ...newByDef.keys()]);
    const historyToInsert: Partial<AttributeValueHistory>[] = [];

    for (const defId of allDefIds) {
      const oldList = oldByDef.get(defId) || [];
      const newList = newByDef.get(defId) || [];

      if (oldList.length === 0 && newList.length > 0) {
        // Все новые записи — CREATED
        for (const item of newList) {
          historyToInsert.push({
            partId,
            attributeDefinitionId: defId,
            changeType: AttributeChangeType.CREATED,
            oldValueString: null,
            oldValueNumber: null,
            oldValueBoolean: null,
            oldValueDate: null,
            oldValueOptionId: null,
            oldValueReferenceId: null,
            newValueString: item.valueString ?? null,
            newValueNumber: item.valueNumber ?? null,
            newValueBoolean: item.valueBoolean ?? null,
            newValueDate: item.valueDate ?? null,
            newValueOptionId: item.valueOptionId ?? null,
            newValueReferenceId: item.valueReferenceId ?? null,
            changedBy,
          });
        }
      } else if (oldList.length > 0 && newList.length === 0) {
        // Все старые записи — DELETED
        for (const item of oldList) {
          historyToInsert.push({
            partId,
            attributeDefinitionId: defId,
            changeType: AttributeChangeType.DELETED,
            oldValueString: item.valueString ?? null,
            oldValueNumber: item.valueNumber ?? null,
            oldValueBoolean: item.valueBoolean ?? null,
            oldValueDate: item.valueDate ?? null,
            oldValueOptionId: item.valueOptionId ?? null,
            oldValueReferenceId: item.valueReferenceId ?? null,
            newValueString: null,
            newValueNumber: null,
            newValueBoolean: null,
            newValueDate: null,
            newValueOptionId: null,
            newValueReferenceId: null,
            changedBy,
          });
        }
      } else if (oldList.length === 1 && newList.length === 1) {
        // Одиночное значение: проверяем на равенство
        const oldItem = oldList[0];
        const newItem = newList[0];

        if (!this.areValuesEqual(oldItem, newItem)) {
          historyToInsert.push({
            partId,
            attributeDefinitionId: defId,
            changeType: AttributeChangeType.UPDATED,
            oldValueString: oldItem.valueString ?? null,
            oldValueNumber: oldItem.valueNumber ?? null,
            oldValueBoolean: oldItem.valueBoolean ?? null,
            oldValueDate: oldItem.valueDate ?? null,
            oldValueOptionId: oldItem.valueOptionId ?? null,
            oldValueReferenceId: oldItem.valueReferenceId ?? null,
            newValueString: newItem.valueString ?? null,
            newValueNumber: newItem.valueNumber ?? null,
            newValueBoolean: newItem.valueBoolean ?? null,
            newValueDate: newItem.valueDate ?? null,
            newValueOptionId: newItem.valueOptionId ?? null,
            newValueReferenceId: newItem.valueReferenceId ?? null,
            changedBy,
          });
        }
      } else {
        // Множественные значения: diff по уникальным ключам
        const oldKeyMap = new Map<string, RawAttributeValueLike>();
        for (const o of oldList) {
          oldKeyMap.set(this.getValueKey(o), o);
        }

        const newKeyMap = new Map<string, RawAttributeValueLike>();
        for (const n of newList) {
          newKeyMap.set(this.getValueKey(n), n);
        }

        // Новые добавленные элементы
        for (const [key, n] of newKeyMap) {
          if (!oldKeyMap.has(key)) {
            historyToInsert.push({
              partId,
              attributeDefinitionId: defId,
              changeType: AttributeChangeType.CREATED,
              oldValueString: null,
              oldValueNumber: null,
              oldValueBoolean: null,
              oldValueDate: null,
              oldValueOptionId: null,
              oldValueReferenceId: null,
              newValueString: n.valueString ?? null,
              newValueNumber: n.valueNumber ?? null,
              newValueBoolean: n.valueBoolean ?? null,
              newValueDate: n.valueDate ?? null,
              newValueOptionId: n.valueOptionId ?? null,
              newValueReferenceId: n.valueReferenceId ?? null,
              changedBy,
            });
          }
        }

        // Удаленные элементы
        for (const [key, o] of oldKeyMap) {
          if (!newKeyMap.has(key)) {
            historyToInsert.push({
              partId,
              attributeDefinitionId: defId,
              changeType: AttributeChangeType.DELETED,
              oldValueString: o.valueString ?? null,
              oldValueNumber: o.valueNumber ?? null,
              oldValueBoolean: o.valueBoolean ?? null,
              oldValueDate: o.valueDate ?? null,
              oldValueOptionId: o.valueOptionId ?? null,
              oldValueReferenceId: o.valueReferenceId ?? null,
              newValueString: null,
              newValueNumber: null,
              newValueBoolean: null,
              newValueDate: null,
              newValueOptionId: null,
              newValueReferenceId: null,
              changedBy,
            });
          }
        }
      }
    }

    if (historyToInsert.length === 0) {
      return [];
    }

    const createdEntities = historyToInsert.map((h) =>
      manager.create(AttributeValueHistory, h),
    );
    return manager.save(AttributeValueHistory, createdEntities);
  }

  private areValuesEqual(
    a: RawAttributeValueLike,
    b: RawAttributeValueLike,
  ): boolean {
    if ((a.valueString ?? null) !== (b.valueString ?? null)) return false;
    if ((a.valueBoolean ?? null) !== (b.valueBoolean ?? null)) return false;
    if ((a.valueOptionId ?? null) !== (b.valueOptionId ?? null)) return false;
    if ((a.valueReferenceId ?? null) !== (b.valueReferenceId ?? null))
      return false;

    // Number comparison
    const numA =
      a.valueNumber !== null && a.valueNumber !== undefined
        ? Number(a.valueNumber)
        : null;
    const numB =
      b.valueNumber !== null && b.valueNumber !== undefined
        ? Number(b.valueNumber)
        : null;
    if (numA !== numB) return false;

    // Date comparison
    const dateA = a.valueDate ? new Date(a.valueDate).getTime() : null;
    const dateB = b.valueDate ? new Date(b.valueDate).getTime() : null;
    if (dateA !== dateB) return false;

    return true;
  }

  private getValueKey(item: RawAttributeValueLike): string {
    if (item.valueOptionId) return `opt:${item.valueOptionId}`;
    if (item.valueReferenceId) return `ref:${item.valueReferenceId}`;
    if (item.valueString !== null && item.valueString !== undefined)
      return `str:${item.valueString}`;
    if (item.valueNumber !== null && item.valueNumber !== undefined)
      return `num:${Number(item.valueNumber)}`;
    if (item.valueBoolean !== null && item.valueBoolean !== undefined)
      return `bool:${item.valueBoolean}`;
    if (item.valueDate) return `date:${new Date(item.valueDate).toISOString()}`;
    return 'null';
  }

  /**
   * История изменений атрибутов конкретной детали.
   */
  async getHistoryByPart(
    partId: string,
    filterDto: AttributeHistoryFilterDto,
  ): Promise<PaginatedResponseDto<AttributeValueHistoryResponseDto>> {
    const part = await this.partRepository.findOne({ where: { id: partId } });
    if (!part) {
      throw new NotFoundException(`Part with ID "${partId}" not found`);
    }

    const qb = this.historyRepository
      .createQueryBuilder('h')
      .leftJoinAndSelect('h.attributeDefinition', 'def')
      .leftJoinAndSelect('h.oldValueOption', 'oldOpt')
      .leftJoinAndSelect('h.newValueOption', 'newOpt')
      .leftJoinAndSelect('def.unit', 'unit')
      .where('h.partId = :partId', { partId });

    if (filterDto.attributeDefinitionId) {
      qb.andWhere('h.attributeDefinitionId = :defId', {
        defId: filterDto.attributeDefinitionId,
      });
    }
    if (filterDto.changeType) {
      qb.andWhere('h.changeType = :changeType', {
        changeType: filterDto.changeType,
      });
    }
    if (filterDto.fromDate) {
      qb.andWhere('h.changedAt >= :fromDate', {
        fromDate: new Date(filterDto.fromDate),
      });
    }
    if (filterDto.toDate) {
      qb.andWhere('h.changedAt <= :toDate', {
        toDate: new Date(filterDto.toDate),
      });
    }
    if (filterDto.changedBy) {
      qb.andWhere('h.changedBy = :changedBy', {
        changedBy: filterDto.changedBy,
      });
    }

    qb.orderBy('h.changedAt', 'DESC').addOrderBy('h.id', 'DESC');

    const total = await qb.getCount();
    const items = await qb.skip(filterDto.skip).take(filterDto.limit).getMany();

    const dtos: AttributeValueHistoryResponseDto[] = items.map((item) =>
      this.mapToResponseDto(item, part.sku, part.name),
    );

    return new PaginatedResponseDto(
      dtos,
      total,
      filterDto.page,
      filterDto.limit,
    );
  }

  /**
   * История изменений конкретного определения атрибута по всем деталям.
   */
  async getHistoryByDefinition(
    definitionId: string,
    filterDto: AttributeHistoryFilterDto,
  ): Promise<PaginatedResponseDto<AttributeValueHistoryResponseDto>> {
    const def = await this.definitionRepository.findOne({
      where: { id: definitionId },
    });
    if (!def) {
      throw new NotFoundException(
        `AttributeDefinition with ID "${definitionId}" not found`,
      );
    }

    const qb = this.historyRepository
      .createQueryBuilder('h')
      .leftJoinAndSelect('h.part', 'part')
      .leftJoinAndSelect('h.attributeDefinition', 'def')
      .leftJoinAndSelect('h.oldValueOption', 'oldOpt')
      .leftJoinAndSelect('h.newValueOption', 'newOpt')
      .leftJoinAndSelect('def.unit', 'unit')
      .where('h.attributeDefinitionId = :definitionId', { definitionId });

    if (filterDto.changeType) {
      qb.andWhere('h.changeType = :changeType', {
        changeType: filterDto.changeType,
      });
    }
    if (filterDto.fromDate) {
      qb.andWhere('h.changedAt >= :fromDate', {
        fromDate: new Date(filterDto.fromDate),
      });
    }
    if (filterDto.toDate) {
      qb.andWhere('h.changedAt <= :toDate', {
        toDate: new Date(filterDto.toDate),
      });
    }
    if (filterDto.changedBy) {
      qb.andWhere('h.changedBy = :changedBy', {
        changedBy: filterDto.changedBy,
      });
    }

    qb.orderBy('h.changedAt', 'DESC').addOrderBy('h.id', 'DESC');

    const total = await qb.getCount();
    const items = await qb.skip(filterDto.skip).take(filterDto.limit).getMany();

    const dtos: AttributeValueHistoryResponseDto[] = items.map((item) =>
      this.mapToResponseDto(item, item.part?.sku, item.part?.name),
    );

    return new PaginatedResponseDto(
      dtos,
      total,
      filterDto.page,
      filterDto.limit,
    );
  }

  private mapToResponseDto(
    item: AttributeValueHistory,
    partSku?: string,
    partName?: string,
  ): AttributeValueHistoryResponseDto {
    const def = item.attributeDefinition;
    const unitSymbol = def?.unit?.symbol;

    const extractRawValue = (prefix: 'old' | 'new') => {
      const str = prefix === 'old' ? item.oldValueString : item.newValueString;
      const num = prefix === 'old' ? item.oldValueNumber : item.newValueNumber;
      const bool =
        prefix === 'old' ? item.oldValueBoolean : item.newValueBoolean;
      const date = prefix === 'old' ? item.oldValueDate : item.newValueDate;
      const optId =
        prefix === 'old' ? item.oldValueOptionId : item.newValueOptionId;
      const opt = prefix === 'old' ? item.oldValueOption : item.newValueOption;
      const refId =
        prefix === 'old' ? item.oldValueReferenceId : item.newValueReferenceId;

      if (opt) return opt.value;
      if (optId) return optId;
      if (refId) return refId;
      if (num !== null && num !== undefined) return Number(num);
      if (bool !== null && bool !== undefined) return bool;
      if (date) return date;
      if (str !== null && str !== undefined) return str;
      return null;
    };

    const formatValue = (prefix: 'old' | 'new'): string | null => {
      const raw = extractRawValue(prefix);
      if (raw === null || raw === undefined) return null;

      const opt = prefix === 'old' ? item.oldValueOption : item.newValueOption;
      if (opt) {
        return opt.label;
      }
      if (typeof raw === 'number' && unitSymbol) {
        return `${raw} ${unitSymbol}`;
      }
      if (raw instanceof Date) {
        return raw.toISOString();
      }
      return String(raw);
    };

    return {
      id: item.id,
      partId: item.partId,
      partSku,
      partName,
      attributeDefinitionId: item.attributeDefinitionId,
      attributeKey: def?.key,
      attributeName: def?.label,
      attributeLabel: def?.label,
      changeType: item.changeType,
      oldValue: extractRawValue('old'),
      newValue: extractRawValue('new'),
      oldValueFormatted: formatValue('old'),
      newValueFormatted: formatValue('new'),
      changedBy: item.changedBy,
      changedAt: item.changedAt,
    };
  }
}
