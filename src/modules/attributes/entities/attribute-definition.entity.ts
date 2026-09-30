import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AbstractBaseEntity } from '../../../common/entities/abstract-base.entity';
import { AttributeDataType } from '../enums/attribute-data-type.enum';
import { Unit } from '../../units/entities/unit.entity';
import { AttributeOption } from './attribute-option.entity';

@Entity('attribute_definitions')
@Index('idx_attribute_definitions_key', ['key'], { unique: true })
@Index('idx_attribute_definitions_data_type', ['dataType'])
@Index('idx_attribute_definitions_unit_id', ['unitId'])
export class AttributeDefinition extends AbstractBaseEntity {
  @ApiProperty({
    example: 'nominal_voltage',
    description: 'Машинный уникальный ключ атрибута',
  })
  @Column({ type: 'varchar', length: 100, unique: true })
  key!: string;

  @ApiProperty({
    example: 'Номинальное напряжение',
    description: 'Человекочитаемое название атрибута',
  })
  @Column({ type: 'varchar', length: 200 })
  label!: string;

  @ApiProperty({
    enum: AttributeDataType,
    example: AttributeDataType.NUMBER,
    description: 'Тип данных динамического атрибута',
  })
  @Column({
    name: 'data_type',
    type: 'enum',
    enum: AttributeDataType,
  })
  dataType!: AttributeDataType;

  @ApiPropertyOptional({
    example: '7b8f9e10-1234-4567-89ab-cdef01234567',
    description: 'ID единицы измерения (опционально)',
  })
  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId?: string | null;

  @ManyToOne(() => Unit, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'unit_id' })
  unit?: Unit | null;

  @ApiProperty({
    example: false,
    description: 'Обязателен ли атрибут для заполнения в карточке детали',
  })
  @Column({ name: 'is_required', type: 'boolean', default: false })
  isRequired!: boolean;

  @ApiProperty({
    example: false,
    description: 'Может ли атрибут иметь несколько значений у одной детали',
  })
  @Column({ name: 'is_multiple', type: 'boolean', default: false })
  isMultiple!: boolean;

  @ApiProperty({
    example: 0,
    description: 'Порядок сортировки в интерфейсе',
  })
  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder!: number;

  @ApiProperty({
    type: () => [AttributeOption],
    description: 'Варианты значений (для enum/multi_enum)',
  })
  @OneToMany(() => AttributeOption, (option) => option.attributeDefinition, {
    cascade: true,
  })
  options?: AttributeOption[];
}
