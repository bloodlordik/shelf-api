import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Part } from '../entities/part.entity';
import { CategoriesService } from '../../categories/categories.service';
import { PartFilterDto } from '../dto/part-filter.dto';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';

@Injectable()
export class PartsFilterService {
  constructor(
    @InjectRepository(Part)
    private readonly partsRepository: Repository<Part>,
    private readonly categoriesService: CategoriesService,
  ) {}

  async filterParts(
    filterDto: PartFilterDto,
    rawQuery?: Record<string, unknown>,
  ): Promise<PaginatedResponseDto<Part>> {
    const page = filterDto.page || 1;
    const limit = filterDto.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.partsRepository
      .createQueryBuilder('part')
      .leftJoinAndSelect('part.category', 'category')
      .leftJoinAndSelect('part.tags', 'tag');

    // 1. Fulltext / basic field search
    if (filterDto.search && filterDto.search.trim()) {
      const searchTerm = `%${filterDto.search.trim()}%`;
      qb.andWhere(
        '(part.name ILIKE :search OR part.sku ILIKE :search OR part.description ILIKE :search)',
        { search: searchTerm },
      );
    }

    // 2. Category filtering
    if (filterDto.categoryId) {
      if (filterDto.includeSubcategories) {
        const categoryIds = await this.categoriesService.getAllSubcategoryIds(
          filterDto.categoryId,
        );
        qb.andWhere('part.categoryId IN (:...categoryIds)', { categoryIds });
      } else {
        qb.andWhere('part.categoryId = :categoryId', {
          categoryId: filterDto.categoryId,
        });
      }
    }

    // 3. Strict AND-filtering by tags
    if (filterDto.tagIds && filterDto.tagIds.length > 0) {
      const tagIds = filterDto.tagIds;
      const tagCount = tagIds.length;

      // Subquery to find part IDs that have ALL specified tags
      const subQuery = this.partsRepository
        .createQueryBuilder('sub_part')
        .select('sub_part.id')
        .innerJoin(
          'sub_part.tags',
          'sub_tag',
          'sub_tag.id IN (:...sub_tagIds)',
          { sub_tagIds: tagIds },
        )
        .groupBy('sub_part.id')
        .having('COUNT(DISTINCT sub_tag.id) = :sub_tagCount', {
          sub_tagCount: tagCount,
        });

      qb.andWhere(`part.id IN (${subQuery.getQuery()})`);
      qb.setParameters({
        ...qb.getParameters(),
        ...subQuery.getParameters(),
      });
    }

    // 4. Dynamic attributes filtering via JSONB
    const dynamicAttr: Record<string, unknown> = {
      ...(filterDto.attr && typeof filterDto.attr === 'object'
        ? filterDto.attr
        : {}),
    };

    // Extract any bracket keys from rawQuery or filterDto (e.g. attr[nominal_voltage][gte] or attr[tolerance])
    const sources = [
      rawQuery || {},
      filterDto as unknown as Record<string, unknown>,
    ];
    for (const source of sources) {
      for (const [key, value] of Object.entries(source)) {
        const bracketMatch = key.match(/^attr\[([^\]]+)\](?:\[([^\]]+)\])?$/);
        if (bracketMatch) {
          const [, attrKey, subKey] = bracketMatch;
          if (subKey) {
            const current =
              (dynamicAttr[attrKey] as Record<string, unknown>) || {};
            current[subKey] = value;
            dynamicAttr[attrKey] = current;
          } else {
            dynamicAttr[attrKey] = value;
          }
        }
      }
    }

    const SAFE_ATTR_KEY_REGEX = /^[a-zA-Z0-9_]{1,64}$/;

    if (Object.keys(dynamicAttr).length > 0) {
      let paramIndex = 0;
      for (const [attrKey, condition] of Object.entries(dynamicAttr)) {
        if (
          !attrKey ||
          !SAFE_ATTR_KEY_REGEX.test(attrKey) ||
          condition === undefined ||
          condition === null
        ) {
          continue;
        }

        if (typeof condition === 'object' && !Array.isArray(condition)) {
          const condObj = condition as Record<string, unknown>;
          if (condObj.gte !== undefined) {
            const kParam = `attr_k_${paramIndex}`;
            const vParam = `attr_gte_${paramIndex++}`;
            qb.andWhere(
              `jsonb_typeof(part.attributes_snapshot->:${kParam}) = 'number' AND (part.attributes_snapshot->>:${kParam})::numeric >= :${vParam}`,
              { [kParam]: attrKey, [vParam]: Number(condObj.gte) },
            );
          }
          if (condObj.lte !== undefined) {
            const kParam = `attr_k_${paramIndex}`;
            const vParam = `attr_lte_${paramIndex++}`;
            qb.andWhere(
              `jsonb_typeof(part.attributes_snapshot->:${kParam}) = 'number' AND (part.attributes_snapshot->>:${kParam})::numeric <= :${vParam}`,
              { [kParam]: attrKey, [vParam]: Number(condObj.lte) },
            );
          }
          if (condObj.eq !== undefined) {
            const kParam = `attr_k_${paramIndex}`;
            const vParam = `attr_eq_${paramIndex++}`;
            qb.andWhere(`part.attributes_snapshot->>:${kParam} = :${vParam}`, {
              [kParam]: attrKey,
              [vParam]:
                typeof condObj.eq === 'string' ||
                typeof condObj.eq === 'number' ||
                typeof condObj.eq === 'boolean'
                  ? String(condObj.eq)
                  : JSON.stringify(condObj.eq),
            });
          }
          if (condObj.in !== undefined) {
            const rawIn = condObj.in;
            const values = Array.isArray(rawIn)
              ? rawIn
                  .map((v) =>
                    typeof v === 'string' ||
                    typeof v === 'number' ||
                    typeof v === 'boolean'
                      ? String(v).trim()
                      : '',
                  )
                  .filter(Boolean)
              : typeof rawIn === 'string'
                ? rawIn
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean)
                : typeof rawIn === 'number' || typeof rawIn === 'boolean'
                  ? [String(rawIn)]
                  : [];
            if (values.length > 0) {
              const kParam = `attr_k_${paramIndex}`;
              const vParam = `attr_in_${paramIndex++}`;
              qb.andWhere(
                `(part.attributes_snapshot->>:${kParam} IN (:...${vParam}) OR part.attributes_snapshot->:${kParam} ?| array[:...${vParam}])`,
                { [kParam]: attrKey, [vParam]: values },
              );
            }
          }
        } else if (typeof condition === 'boolean') {
          const kParam = `attr_k_${paramIndex}`;
          const vParam = `attr_bool_${paramIndex++}`;
          qb.andWhere(
            `jsonb_typeof(part.attributes_snapshot->:${kParam}) = 'boolean' AND (part.attributes_snapshot->>:${kParam})::boolean = :${vParam}`,
            { [kParam]: attrKey, [vParam]: condition },
          );
        } else if (typeof condition === 'number') {
          const kParam = `attr_k_${paramIndex}`;
          const vParam = `attr_num_${paramIndex++}`;
          qb.andWhere(
            `jsonb_typeof(part.attributes_snapshot->:${kParam}) = 'number' AND (part.attributes_snapshot->>:${kParam})::numeric = :${vParam}`,
            { [kParam]: attrKey, [vParam]: condition },
          );
        } else if (typeof condition === 'string') {
          const kParam = `attr_k_${paramIndex}`;
          const vParam = `attr_str_${paramIndex++}`;
          // Matches scalar string or element inside jsonb array
          qb.andWhere(
            `(part.attributes_snapshot->>:${kParam} = :${vParam} OR part.attributes_snapshot->:${kParam} ? :${vParam})`,
            { [kParam]: attrKey, [vParam]: condition },
          );
        }
      }
    }
    // 5. Quantity filtering
    if (filterDto.minQuantity !== undefined) {
      qb.andWhere('part.quantity >= :minQuantity', {
        minQuantity: filterDto.minQuantity,
      });
    }
    if (filterDto.maxQuantity !== undefined) {
      qb.andWhere('part.quantity <= :maxQuantity', {
        maxQuantity: filterDto.maxQuantity,
      });
    }

    // 6. Dynamic Sorting
    const sortFieldMap: Record<string, string> = {
      createdAt: 'part.createdAt',
      quantity: 'part.quantity',
      name: 'part.name',
      sku: 'part.sku',
    };
    const sortField =
      filterDto.sortBy && sortFieldMap[filterDto.sortBy]
        ? sortFieldMap[filterDto.sortBy]
        : 'part.createdAt';
    const sortOrder =
      filterDto.sortOrder && filterDto.sortOrder.toUpperCase() === 'ASC'
        ? 'ASC'
        : 'DESC';

    if (filterDto.sortBy === 'quantity') {
      qb.orderBy('part.quantity', sortOrder);
      qb.addOrderBy('part.name', 'ASC');
    } else {
      qb.orderBy(sortField, sortOrder);
    }

    qb.skip(skip).take(limit);
    const [items, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(items, total, page, limit);
  }
}
