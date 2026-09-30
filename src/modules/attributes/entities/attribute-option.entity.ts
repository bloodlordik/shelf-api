import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AbstractBaseEntity } from '../../../common/entities/abstract-base.entity';
import { AttributeDefinition } from './attribute-definition.entity';

@Entity('attribute_options')
@Unique('uq_attribute_options_def_value', ['attributeDefinitionId', 'value'])
@Index('idx_attribute_options_def_id', ['attributeDefinitionId'])
export class AttributeOption extends AbstractBaseEntity {
  @ApiProperty({
    example: '7b8f9e10-1234-4567-89ab-cdef01234567',
    description: 'ID определения атрибута',
  })
  @Column({ name: 'attribute_definition_id', type: 'uuid' })
  attributeDefinitionId!: string;

  @ManyToOne(() => AttributeDefinition, (definition) => definition.options, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'attribute_definition_id' })
  attributeDefinition!: AttributeDefinition;

  @ApiProperty({
    example: 'smd_0805',
    description: 'Техническое значение опции',
  })
  @Column({ type: 'varchar', length: 100 })
  value!: string;

  @ApiProperty({
    example: 'SMD 0805',
    description: 'Отображаемое название опции',
  })
  @Column({ type: 'varchar', length: 200 })
  label!: string;

  @ApiProperty({
    example: 0,
    description: 'Порядок сортировки',
  })
  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder!: number;
}
