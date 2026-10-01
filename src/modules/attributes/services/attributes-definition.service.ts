import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttributeDefinition } from '../entities/attribute-definition.entity';
import { AttributeOption } from '../entities/attribute-option.entity';
import { Unit } from '../../units/entities/unit.entity';
import { CreateAttributeDefinitionDto } from '../dto/create-attribute-definition.dto';
import { UpdateAttributeDefinitionDto } from '../dto/update-attribute-definition.dto';
import { CreateAttributeOptionDto } from '../dto/create-attribute-option.dto';
import { UpdateAttributeOptionDto } from '../dto/update-attribute-option.dto';
import { AttributeDataType } from '../enums/attribute-data-type.enum';

@Injectable()
export class AttributeDefinitionsService {
  constructor(
    @InjectRepository(AttributeDefinition)
    private readonly definitionRepository: Repository<AttributeDefinition>,
    @InjectRepository(AttributeOption)
    private readonly optionRepository: Repository<AttributeOption>,
    @InjectRepository(Unit)
    private readonly unitRepository: Repository<Unit>,
  ) {}

  async createDefinition(
    createDto: CreateAttributeDefinitionDto,
  ): Promise<AttributeDefinition> {
    const existing = await this.definitionRepository.findOne({
      where: { key: createDto.key },
    });
    if (existing) {
      throw new ConflictException(
        `Attribute definition with key "${createDto.key}" already exists`,
      );
    }

    if (createDto.unitId) {
      const unit = await this.unitRepository.findOne({
        where: { id: createDto.unitId },
      });
      if (!unit) {
        throw new NotFoundException(
          `Unit with ID "${createDto.unitId}" not found`,
        );
      }
    }

    const definition = this.definitionRepository.create({
      key: createDto.key,
      label: createDto.label,
      dataType: createDto.dataType,
      unitId: createDto.unitId || null,
      isRequired: createDto.isRequired ?? false,
      isMultiple: createDto.isMultiple ?? false,
      sortOrder: createDto.sortOrder ?? 0,
    });

    const savedDef = await this.definitionRepository.save(definition);

    // If options provided and type is ENUM/MULTI_ENUM, save options
    if (
      createDto.options &&
      createDto.options.length > 0 &&
      (createDto.dataType === AttributeDataType.ENUM ||
        createDto.dataType === AttributeDataType.MULTI_ENUM)
    ) {
      const options = createDto.options.map((opt) =>
        this.optionRepository.create({
          attributeDefinitionId: savedDef.id,
          value: opt.value,
          label: opt.label,
          sortOrder: opt.sortOrder ?? 0,
        }),
      );
      await this.optionRepository.save(options);
    }

    return this.findDefinitionById(savedDef.id);
  }

  async findAllDefinitions(): Promise<AttributeDefinition[]> {
    return this.definitionRepository.find({
      relations: { unit: true, options: true },
      order: {
        sortOrder: 'ASC',
        label: 'ASC',
      },
    });
  }

  async countDefinitions(): Promise<number> {
    return this.definitionRepository.count();
  }

  async findDefinitionById(id: string): Promise<AttributeDefinition> {
    const definition = await this.definitionRepository.findOne({
      where: { id },
      relations: { unit: true, options: true },
    });
    if (!definition) {
      throw new NotFoundException(
        `Attribute definition with ID "${id}" not found`,
      );
    }
    return definition;
  }

  async findDefinitionByKey(key: string): Promise<AttributeDefinition | null> {
    return this.definitionRepository.findOne({
      where: { key },
      relations: { unit: true, options: true },
    });
  }

  async updateDefinition(
    id: string,
    updateDto: UpdateAttributeDefinitionDto,
  ): Promise<AttributeDefinition> {
    const definition = await this.findDefinitionById(id);

    if (updateDto.unitId !== undefined) {
      if (updateDto.unitId !== null) {
        const unit = await this.unitRepository.findOne({
          where: { id: updateDto.unitId },
        });
        if (!unit) {
          throw new NotFoundException(
            `Unit with ID "${updateDto.unitId}" not found`,
          );
        }
      }
      definition.unitId = updateDto.unitId;
    }

    if (updateDto.label !== undefined) definition.label = updateDto.label;
    if (updateDto.isRequired !== undefined)
      definition.isRequired = updateDto.isRequired;
    if (updateDto.isMultiple !== undefined)
      definition.isMultiple = updateDto.isMultiple;
    if (updateDto.sortOrder !== undefined)
      definition.sortOrder = updateDto.sortOrder;

    await this.definitionRepository.save(definition);
    return this.findDefinitionById(id);
  }

  async removeDefinition(id: string): Promise<void> {
    const definition = await this.findDefinitionById(id);
    await this.definitionRepository.remove(definition);
  }

  // --- Options Management ---

  async createOption(
    definitionId: string,
    createOptionDto: CreateAttributeOptionDto,
  ): Promise<AttributeOption> {
    const definition = await this.findDefinitionById(definitionId);

    if (
      definition.dataType !== AttributeDataType.ENUM &&
      definition.dataType !== AttributeDataType.MULTI_ENUM
    ) {
      throw new BadRequestException(
        `Cannot add options to attribute '${definition.key}' with type '${definition.dataType}'. Options are only allowed for ENUM and MULTI_ENUM.`,
      );
    }

    const existing = await this.optionRepository.findOne({
      where: {
        attributeDefinitionId: definitionId,
        value: createOptionDto.value,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Option with value "${createOptionDto.value}" already exists for this attribute`,
      );
    }

    const option = this.optionRepository.create({
      attributeDefinitionId: definitionId,
      value: createOptionDto.value,
      label: createOptionDto.label,
      sortOrder: createOptionDto.sortOrder ?? 0,
    });

    return this.optionRepository.save(option);
  }

  async findOptionById(optionId: string): Promise<AttributeOption> {
    const option = await this.optionRepository.findOne({
      where: { id: optionId },
    });
    if (!option) {
      throw new NotFoundException(
        `Attribute option with ID "${optionId}" not found`,
      );
    }
    return option;
  }

  async updateOption(
    optionId: string,
    updateOptionDto: UpdateAttributeOptionDto,
  ): Promise<AttributeOption> {
    const option = await this.findOptionById(optionId);

    if (
      updateOptionDto.value !== undefined &&
      updateOptionDto.value !== option.value
    ) {
      const existing = await this.optionRepository.findOne({
        where: {
          attributeDefinitionId: option.attributeDefinitionId,
          value: updateOptionDto.value,
        },
      });
      if (existing) {
        throw new ConflictException(
          `Option with value "${updateOptionDto.value}" already exists for this attribute`,
        );
      }
      option.value = updateOptionDto.value;
    }

    if (updateOptionDto.label !== undefined)
      option.label = updateOptionDto.label;
    if (updateOptionDto.sortOrder !== undefined)
      option.sortOrder = updateOptionDto.sortOrder;

    return this.optionRepository.save(option);
  }

  async removeOption(optionId: string): Promise<void> {
    const option = await this.findOptionById(optionId);
    await this.optionRepository.remove(option);
  }
}
