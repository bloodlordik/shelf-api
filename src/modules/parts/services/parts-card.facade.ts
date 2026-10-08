import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Part } from '../entities/part.entity';
import { AttributeValue } from '../entities/attribute-value.entity';
import { StockMovement } from '../../stock/entities/stock-movement.entity';
import { CategoriesService } from '../../categories/categories.service';
import {
  PartCardResponseDto,
  PartCardAttributeItemDto,
  PartCardCategoryDto,
  PartCardTagDto,
  PartCardOptionResponseDto,
  PartCardUnitDto,
} from '../dto/part-card-response.dto';
import { AttributeDataType } from '../../attributes/enums/attribute-data-type.enum';

@Injectable()
export class PartsCardFacade {
  constructor(
    @InjectRepository(Part)
    private readonly partsRepository: Repository<Part>,
    @InjectRepository(AttributeValue)
    private readonly attributeValuesRepository: Repository<AttributeValue>,
    @InjectRepository(StockMovement)
    private readonly stockMovementRepository: Repository<StockMovement>,
    private readonly categoriesService: CategoriesService,
  ) {}

  async getPartCard(partId: string): Promise<PartCardResponseDto> {
    const part = await this.partsRepository.findOne({
      where: { id: partId },
      relations: { category: true, tags: true },
    });

    if (!part) {
      throw new NotFoundException(`Part with ID "${partId}" not found`);
    }

    // 1. Build category with breadcrumbs
    let categoryDto: PartCardCategoryDto | null = null;
    if (part.categoryId) {
      const breadcrumbs = await this.categoriesService.getBreadcrumbs(
        part.categoryId,
      );
      categoryDto = {
        id: part.categoryId,
        name: part.category ? part.category.name : '',
        code: part.category ? part.category.code : null,
        breadcrumbs,
      };
    }

    // 2. Map tags
    const tagsDto: PartCardTagDto[] = (part.tags || []).map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color || null,
    }));

    // 3. Load all attribute values for this part with definition, unit, and options
    const attributeValues = await this.attributeValuesRepository.find({
      where: { partId: part.id },
      relations: {
        attributeDefinition: { unit: true, options: true },
        valueOption: true,
      },
      order: {
        attributeDefinition: { sortOrder: 'ASC' },
        createdAt: 'ASC',
      },
    });

    // Group values by definitionId
    const valuesByDefId = new Map<string, AttributeValue[]>();
    for (const av of attributeValues) {
      const list = valuesByDefId.get(av.attributeDefinitionId) || [];
      list.push(av);
      valuesByDefId.set(av.attributeDefinitionId, list);
    }

    const attributeDtos: PartCardAttributeItemDto[] = [];

    for (const [, values] of valuesByDefId) {
      const firstAv = values[0];
      const def = firstAv.attributeDefinition;
      if (!def) continue;

      const unitDto: PartCardUnitDto | null = def.unit
        ? {
            id: def.unit.id,
            name: def.unit.name,
            symbol: def.unit.symbol,
            group: def.unit.group,
          }
        : null;

      const isMultiple =
        def.isMultiple || def.dataType === AttributeDataType.MULTI_ENUM;

      if (isMultiple) {
        const rawValues: unknown[] = [];
        const optionDtos: PartCardOptionResponseDto[] = [];
        const formattedParts: string[] = [];

        for (const av of values) {
          const { rawVal, formattedVal, optDto } =
            this.formatSingleAttributeValue(def.dataType, av, unitDto?.symbol);
          if (rawVal !== undefined && rawVal !== null) {
            rawValues.push(rawVal);
          }
          if (formattedVal) {
            formattedParts.push(formattedVal);
          }
          if (optDto) {
            optionDtos.push(optDto);
          }
        }

        attributeDtos.push({
          definitionId: def.id,
          key: def.key,
          label: def.label,
          dataType: def.dataType,
          isMultiple: true,
          unit: unitDto,
          value: rawValues,
          formattedValue: formattedParts.join(', '),
          options: optionDtos.length > 0 ? optionDtos : undefined,
        });
      } else {
        const { rawVal, formattedVal, optDto } =
          this.formatSingleAttributeValue(
            def.dataType,
            firstAv,
            unitDto?.symbol,
          );

        attributeDtos.push({
          definitionId: def.id,
          key: def.key,
          label: def.label,
          dataType: def.dataType,
          isMultiple: false,
          unit: unitDto,
          value: rawVal,
          formattedValue: formattedVal,
          option: optDto || null,
        });
      }
    }

    const totalMovementsCount = await this.stockMovementRepository.count({
      where: { partId },
    });
    const lastMovement = await this.stockMovementRepository.findOne({
      where: { partId },
      order: { performedAt: 'DESC' },
    });

    return {
      id: part.id,
      name: part.name,
      sku: part.sku,
      description: part.description || null,
      quantity: part.quantity ?? 0,
      stockSummary: {
        lastMovementAt: lastMovement?.performedAt || null,
        totalMovementsCount,
      },
      category: categoryDto,
      tags: tagsDto,
      attributes: attributeDtos,
      createdAt: part.createdAt,
      updatedAt: part.updatedAt,
    };
  }

  private formatSingleAttributeValue(
    dataType: AttributeDataType,
    av: AttributeValue,
    unitSymbol?: string,
  ): {
    rawVal: unknown;
    formattedVal: string;
    optDto?: PartCardOptionResponseDto | null;
  } {
    switch (dataType) {
      case AttributeDataType.NUMBER:
      case AttributeDataType.MONEY: {
        const num = av.valueNumber ?? null;
        const formatted =
          num !== null
            ? unitSymbol
              ? `${num} ${unitSymbol}`
              : String(num)
            : '';
        return { rawVal: num, formattedVal: formatted };
      }

      case AttributeDataType.BOOLEAN: {
        const bool = av.valueBoolean ?? null;
        const formatted = bool === true ? 'Да' : bool === false ? 'Нет' : '';
        return { rawVal: bool, formattedVal: formatted };
      }

      case AttributeDataType.DATE: {
        const date = av.valueDate ? new Date(av.valueDate) : null;
        const formatted = date ? date.toISOString().split('T')[0] : '';
        return { rawVal: date?.toISOString() || null, formattedVal: formatted };
      }

      case AttributeDataType.ENUM:
      case AttributeDataType.MULTI_ENUM: {
        const opt = av.valueOption;
        if (opt) {
          const optDto: PartCardOptionResponseDto = {
            id: opt.id,
            value: opt.value,
            label: opt.label,
          };
          return {
            rawVal: opt.value,
            formattedVal: opt.label,
            optDto,
          };
        }
        return {
          rawVal: av.valueOptionId || null,
          formattedVal: '',
        };
      }

      case AttributeDataType.REFERENCE: {
        return {
          rawVal: av.valueReferenceId || null,
          formattedVal: av.valueReferenceId || '',
        };
      }

      case AttributeDataType.TEXT:
      case AttributeDataType.LONG_TEXT:
      case AttributeDataType.FILE:
      default: {
        const str = av.valueString || '';
        return { rawVal: str, formattedVal: str };
      }
    }
  }
}
