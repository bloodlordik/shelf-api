import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Part } from './part.entity';
import { AttributeDefinition } from '../../attributes/entities/attribute-definition.entity';
import { AttributeOption } from '../../attributes/entities/attribute-option.entity';

@Entity('attribute_values')
@Index('idx_attribute_values_part_def', ['partId', 'attributeDefinitionId'])
@Index('idx_attribute_values_def_id', ['attributeDefinitionId'])
@Index('idx_attribute_values_option_id', ['valueOptionId'])
@Index('idx_attribute_values_reference_id', ['valueReferenceId'])
export class AttributeValue {
  @ApiProperty({
    example: '7b8f9e10-1234-4567-89ab-cdef01234567',
    description: 'Уникальный идентификатор значения атрибута',
  })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({
    example: '7b8f9e10-1234-4567-89ab-cdef01234567',
    description: 'ID детали',
  })
  @Column({ name: 'part_id', type: 'uuid' })
  partId!: string;

  @ManyToOne(() => Part, (part) => part.attributeValues, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'part_id' })
  part!: Part;

  @ApiProperty({
    example: '7b8f9e10-1234-4567-89ab-cdef01234567',
    description: 'ID определения атрибута',
  })
  @Column({ name: 'attribute_definition_id', type: 'uuid' })
  attributeDefinitionId!: string;

  @ManyToOne(() => AttributeDefinition, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'attribute_definition_id' })
  attributeDefinition!: AttributeDefinition;

  @ApiPropertyOptional({
    example: 'Текст или ссылка',
    description: 'Строковое значение (для text, long_text, file)',
  })
  @Column({ name: 'value_string', type: 'text', nullable: true })
  valueString?: string | null;

  @ApiPropertyOptional({
    example: 10.5,
    description: 'Числовое значение (для number, money)',
  })
  @Column({
    name: 'value_number',
    type: 'numeric',
    precision: 18,
    scale: 6,
    nullable: true,
    transformer: {
      to: (value?: number | null) => value,
      from: (value?: string | null) =>
        value !== null && value !== undefined ? parseFloat(value) : null,
    },
  })
  valueNumber?: number | null;

  @ApiPropertyOptional({
    example: true,
    description: 'Булево значение',
  })
  @Column({ name: 'value_boolean', type: 'boolean', nullable: true })
  valueBoolean?: boolean | null;

  @ApiPropertyOptional({
    example: '2026-09-24T10:00:00.000Z',
    description: 'Значение даты',
  })
  @Column({ name: 'value_date', type: 'timestamptz', nullable: true })
  valueDate?: Date | null;

  @ApiPropertyOptional({
    example: '7b8f9e10-1234-4567-89ab-cdef01234567',
    description: 'ID выбранной опции (для enum/multi_enum)',
  })
  @Column({ name: 'value_option_id', type: 'uuid', nullable: true })
  valueOptionId?: string | null;

  @ManyToOne(() => AttributeOption, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'value_option_id' })
  valueOption?: AttributeOption | null;

  @ApiPropertyOptional({
    example: '7b8f9e10-1234-4567-89ab-cdef01234567',
    description: 'ID целевой сущности (для reference)',
  })
  @Column({ name: 'value_reference_id', type: 'uuid', nullable: true })
  valueReferenceId?: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;
}
