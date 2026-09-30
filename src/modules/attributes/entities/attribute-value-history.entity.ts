import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Part } from '../../parts/entities/part.entity';
import { AttributeDefinition } from './attribute-definition.entity';
import { AttributeOption } from './attribute-option.entity';
import { Actor } from '../../actors/entities/actor.entity';
import { AttributeChangeType } from '../enums/attribute-change-type.enum';

@Entity('attribute_value_history')
@Index('idx_attr_val_hist_part_changed_at', ['partId', 'changedAt'])
@Index('idx_attr_val_hist_part_def', [
  'partId',
  'attributeDefinitionId',
  'changedAt',
])
@Index('idx_attr_val_hist_changed_by', ['changedBy', 'changedAt'])
@Index('idx_attr_val_hist_def', ['attributeDefinitionId', 'changedAt'])
export class AttributeValueHistory {
  @ApiProperty({ example: '7b8f9e10-1234-4567-89ab-cdef01234567' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ example: '7b8f9e10-1234-4567-89ab-cdef01234567' })
  @Column({ name: 'part_id', type: 'uuid' })
  partId!: string;

  @ManyToOne(() => Part, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'part_id' })
  part!: Part;

  @ApiProperty({ example: '7b8f9e10-1234-4567-89ab-cdef01234567' })
  @Column({ name: 'attribute_definition_id', type: 'uuid' })
  attributeDefinitionId!: string;

  @ManyToOne(() => AttributeDefinition, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'attribute_definition_id' })
  attributeDefinition!: AttributeDefinition;

  @ApiProperty({
    enum: AttributeChangeType,
    example: AttributeChangeType.UPDATED,
  })
  @Column({
    name: 'change_type',
    type: 'varchar',
    length: 20,
  })
  changeType!: AttributeChangeType;

  // Старые значения (типизированные EAV колонки)
  @Column({ name: 'old_value_string', type: 'text', nullable: true })
  oldValueString?: string | null;

  @Column({
    name: 'old_value_number',
    type: 'numeric',
    precision: 15,
    scale: 4,
    nullable: true,
  })
  oldValueNumber?: number | null;

  @Column({ name: 'old_value_boolean', type: 'boolean', nullable: true })
  oldValueBoolean?: boolean | null;

  @Column({ name: 'old_value_date', type: 'timestamptz', nullable: true })
  oldValueDate?: Date | null;

  @Column({ name: 'old_value_option_id', type: 'uuid', nullable: true })
  oldValueOptionId?: string | null;

  @ManyToOne(() => AttributeOption, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'old_value_option_id' })
  oldValueOption?: AttributeOption | null;

  @Column({ name: 'old_value_reference_id', type: 'uuid', nullable: true })
  oldValueReferenceId?: string | null;

  // Новые значения (типизированные EAV колонки)
  @Column({ name: 'new_value_string', type: 'text', nullable: true })
  newValueString?: string | null;

  @Column({
    name: 'new_value_number',
    type: 'numeric',
    precision: 15,
    scale: 4,
    nullable: true,
  })
  newValueNumber?: number | null;

  @Column({ name: 'new_value_boolean', type: 'boolean', nullable: true })
  newValueBoolean?: boolean | null;

  @Column({ name: 'new_value_date', type: 'timestamptz', nullable: true })
  newValueDate?: Date | null;

  @Column({ name: 'new_value_option_id', type: 'uuid', nullable: true })
  newValueOptionId?: string | null;

  @ManyToOne(() => AttributeOption, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'new_value_option_id' })
  newValueOption?: AttributeOption | null;

  @Column({ name: 'new_value_reference_id', type: 'uuid', nullable: true })
  newValueReferenceId?: string | null;

  @ApiProperty({ example: 42, description: 'Целочисленный ID актора' })
  @Column({ name: 'changed_by', type: 'integer' })
  changedBy!: number;

  @ManyToOne(() => Actor, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'changed_by' })
  actor!: Actor;

  @ApiProperty({ example: '2026-09-24T10:00:00.000Z' })
  @CreateDateColumn({
    name: 'changed_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  changedAt!: Date;
}
