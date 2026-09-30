import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In, EntityManager } from 'typeorm';
import { Part } from '../entities/part.entity';
import { AttributeValue } from '../entities/attribute-value.entity';
import { Tag } from '../../tags/entities/tag.entity';
import { Category } from '../../categories/entities/category.entity';
import {
  CreatePartDto,
  PartAttributeValueInputDto,
} from '../dto/create-part.dto';
import { UpdatePartDto } from '../dto/update-part.dto';
import { ReplacePartAttributesDto } from '../dto/replace-part-attributes.dto';
import {
  AttributesValidationService,
  ValidatedAttributeRecord,
} from '../../attributes/services/attributes-validation.service';
import { AttributeHistoryService } from '../../attributes/services/attribute-history.service';
import { PartsSnapshotService } from './parts-snapshot.service';

@Injectable()
export class PartsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Part)
    private readonly partsRepository: Repository<Part>,
    @InjectRepository(Tag)
    private readonly tagsRepository: Repository<Tag>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(AttributeValue)
    private readonly attributeValueRepository: Repository<AttributeValue>,
    private readonly attributesValidationService: AttributesValidationService,
    private readonly attributeHistoryService: AttributeHistoryService,
    private readonly partsSnapshotService: PartsSnapshotService,
  ) {}

  async create(createPartDto: CreatePartDto): Promise<Part> {
    const existingSku = await this.partsRepository.findOne({
      where: { sku: createPartDto.sku },
    });
    if (existingSku) {
      throw new ConflictException(
        `Part with SKU "${createPartDto.sku}" already exists`,
      );
    }

    if (createPartDto.categoryId) {
      const category = await this.categoryRepository.findOne({
        where: { id: createPartDto.categoryId },
      });
      if (!category) {
        throw new NotFoundException(
          `Category with ID "${createPartDto.categoryId}" not found`,
        );
      }
    }

    let tags: Tag[] = [];
    if (createPartDto.tagIds && createPartDto.tagIds.length > 0) {
      tags = await this.tagsRepository.find({
        where: { id: In(createPartDto.tagIds) },
      });
    }

    // Validate dynamic attributes
    const validatedAttributes: ValidatedAttributeRecord[] =
      await this.attributesValidationService.validateAttributes(
        createPartDto.attributes || [],
        false,
      );

    // Build JSONB snapshot
    const attributesSnapshot = this.partsSnapshotService.buildSnapshot({
      tags,
      attributes: validatedAttributes,
    });

    return this.dataSource.transaction(async (manager) => {
      const part = manager.create(Part, {
        name: createPartDto.name,
        sku: createPartDto.sku,
        description: createPartDto.description || null,
        categoryId: createPartDto.categoryId || null,
        quantity: 0,
        tags,
        attributesSnapshot,
      });

      const savedPart = await manager.save(Part, part);

      // Create and save AttributeValue records
      const attributeValueEntities: AttributeValue[] = [];
      for (const rec of validatedAttributes) {
        for (const item of rec.items) {
          const av = manager.create(AttributeValue, {
            partId: savedPart.id,
            attributeDefinitionId: rec.definition.id,
            valueString: item.value_string ?? null,
            valueNumber: item.value_number ?? null,
            valueBoolean: item.value_boolean ?? null,
            valueDate: item.value_date ?? null,
            valueOptionId: item.value_option_id ?? null,
            valueReferenceId: item.value_reference_id ?? null,
          });
          attributeValueEntities.push(av);
        }
      }

      if (attributeValueEntities.length > 0) {
        await manager.save(AttributeValue, attributeValueEntities);

        if (createPartDto.actorId) {
          await this.attributeHistoryService.recordAttributeDiff(
            savedPart.id,
            [],
            attributeValueEntities,
            createPartDto.actorId,
            manager,
          );
        }
      }

      return this.findOne(savedPart.id, manager);
    });
  }

  async findOne(id: string, manager?: EntityManager): Promise<Part> {
    const repo = manager ? manager.getRepository(Part) : this.partsRepository;
    const part = await repo.findOne({
      where: { id },
      relations: { category: true, tags: true },
    });
    if (!part) {
      throw new NotFoundException(`Part with ID "${id}" not found`);
    }
    return part;
  }

  async update(id: string, updatePartDto: UpdatePartDto): Promise<Part> {
    const part = await this.findOne(id);

    if (updatePartDto.sku && updatePartDto.sku !== part.sku) {
      const existingSku = await this.partsRepository.findOne({
        where: { sku: updatePartDto.sku },
      });
      if (existingSku && existingSku.id !== id) {
        throw new ConflictException(
          `Part with SKU "${updatePartDto.sku}" already exists`,
        );
      }
      part.sku = updatePartDto.sku;
    }

    if (updatePartDto.name !== undefined) part.name = updatePartDto.name;
    if (updatePartDto.description !== undefined)
      part.description = updatePartDto.description || null;

    if (updatePartDto.categoryId !== undefined) {
      if (updatePartDto.categoryId !== null) {
        const category = await this.categoryRepository.findOne({
          where: { id: updatePartDto.categoryId },
        });
        if (!category) {
          throw new NotFoundException(
            `Category with ID "${updatePartDto.categoryId}" not found`,
          );
        }
      }
      part.categoryId = updatePartDto.categoryId;
    }

    if (updatePartDto.tagIds !== undefined) {
      part.tags = await this.tagsRepository.find({
        where: { id: In(updatePartDto.tagIds) },
      });
    }

    let validatedAttributes: ValidatedAttributeRecord[] | null = null;
    if (updatePartDto.attributes !== undefined) {
      validatedAttributes =
        await this.attributesValidationService.validateAttributes(
          updatePartDto.attributes,
          true,
        );
    }

    return this.dataSource.transaction(async (manager) => {
      if (validatedAttributes !== null) {
        const touchedDefIds = validatedAttributes.map((v) => v.definition.id);

        let oldAttributeValues: AttributeValue[] = [];
        if (touchedDefIds.length > 0) {
          oldAttributeValues = await manager.find(AttributeValue, {
            where: {
              partId: id,
              attributeDefinitionId: In(touchedDefIds),
            },
          });

          await manager.delete(AttributeValue, {
            partId: id,
            attributeDefinitionId: In(touchedDefIds),
          });
        }

        // Insert new attribute values
        const newEntities: AttributeValue[] = [];
        for (const rec of validatedAttributes) {
          for (const item of rec.items) {
            const av = manager.create(AttributeValue, {
              partId: id,
              attributeDefinitionId: rec.definition.id,
              valueString: item.value_string ?? null,
              valueNumber: item.value_number ?? null,
              valueBoolean: item.value_boolean ?? null,
              valueDate: item.value_date ?? null,
              valueOptionId: item.value_option_id ?? null,
              valueReferenceId: item.value_reference_id ?? null,
            });
            newEntities.push(av);
          }
        }
        if (newEntities.length > 0) {
          await manager.save(AttributeValue, newEntities);
        }

        if (updatePartDto.actorId) {
          await this.attributeHistoryService.recordAttributeDiff(
            id,
            oldAttributeValues,
            newEntities,
            updatePartDto.actorId,
            manager,
          );
        }

        // Rebuild full snapshot by fetching all current attribute values
        const allCurrentValues = await manager.find(AttributeValue, {
          where: { partId: id },
          relations: {
            attributeDefinition: { unit: true, options: true },
            valueOption: true,
          },
        });

        // Group into ValidatedAttributeRecord shape
        const currentByDefId = new Map<string, AttributeValue[]>();
        for (const av of allCurrentValues) {
          const list = currentByDefId.get(av.attributeDefinitionId) || [];
          list.push(av);
          currentByDefId.set(av.attributeDefinitionId, list);
        }

        const snapshotAttributes: ValidatedAttributeRecord[] = [];
        for (const [, values] of currentByDefId) {
          const def = values[0].attributeDefinition;
          snapshotAttributes.push({
            definition: def,
            items: values.map((v) => ({
              value_string: v.valueString,
              value_number: v.valueNumber,
              value_boolean: v.valueBoolean,
              value_date: v.valueDate,
              value_option_id: v.valueOptionId,
              value_reference_id: v.valueReferenceId,
              option_value: v.valueOption?.value,
              option_label: v.valueOption?.label,
            })),
          });
        }

        part.attributesSnapshot = this.partsSnapshotService.buildSnapshot({
          tags: part.tags,
          attributes: snapshotAttributes,
        });
      } else if (updatePartDto.tagIds !== undefined) {
        // If only tags updated, update tags in snapshot
        part.attributesSnapshot = {
          ...part.attributesSnapshot,
          tags: (part.tags || []).map((t) => t.name.toLowerCase()),
          tag_ids: (part.tags || []).map((t) => t.id),
        };
      }

      await manager.save(Part, part);
      return this.findOne(id, manager);
    });
  }

  async replaceAttributes(
    id: string,
    payload: ReplacePartAttributesDto | PartAttributeValueInputDto[],
  ): Promise<Part> {
    const part = await this.findOne(id);

    let rawAttributes: PartAttributeValueInputDto[];
    let actorId: number | undefined;

    if (Array.isArray(payload)) {
      rawAttributes = payload;
    } else {
      rawAttributes = payload.attributes || [];
      actorId = payload.actorId;
    }

    const validatedAttributes =
      await this.attributesValidationService.validateAttributes(
        rawAttributes,
        false,
      );

    return this.dataSource.transaction(async (manager) => {
      // 1. Fetch old attribute values for history logging
      const oldValues = await manager.find(AttributeValue, {
        where: { partId: id },
      });

      // 2. Delete all existing attribute values for this part
      await manager.delete(AttributeValue, { partId: id });

      // 3. Insert new attribute values
      const newEntities: AttributeValue[] = [];
      for (const rec of validatedAttributes) {
        for (const item of rec.items) {
          const av = manager.create(AttributeValue, {
            partId: id,
            attributeDefinitionId: rec.definition.id,
            valueString: item.value_string ?? null,
            valueNumber: item.value_number ?? null,
            valueBoolean: item.value_boolean ?? null,
            valueDate: item.value_date ?? null,
            valueOptionId: item.value_option_id ?? null,
            valueReferenceId: item.value_reference_id ?? null,
          });
          newEntities.push(av);
        }
      }

      if (newEntities.length > 0) {
        await manager.save(AttributeValue, newEntities);
      }

      // 4. Log diff if actorId is provided
      if (actorId) {
        await this.attributeHistoryService.recordAttributeDiff(
          id,
          oldValues,
          newEntities,
          actorId,
          manager,
        );
      }

      // 5. Rebuild and save snapshot
      part.attributesSnapshot = this.partsSnapshotService.buildSnapshot({
        tags: part.tags,
        attributes: validatedAttributes,
      });

      await manager.save(Part, part);
      return this.findOne(id, manager);
    });
  }

  async remove(id: string): Promise<void> {
    const part = await this.findOne(id);
    await this.partsRepository.remove(part);
  }
}
