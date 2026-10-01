import {
  Entity,
  Column,
  ManyToOne,
  ManyToMany,
  OneToMany,
  JoinColumn,
  JoinTable,
  Index,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AbstractBaseEntity } from '../../../common/entities/abstract-base.entity';
import { Category } from '../../categories/entities/category.entity';
import { Tag } from '../../tags/entities/tag.entity';
import { AttributeValue } from './attribute-value.entity';

@Entity('parts')
@Index('idx_parts_sku', ['sku'], { unique: true })
@Index('idx_parts_category_id', ['categoryId'])
@Index('idx_parts_created_at', ['createdAt'])
@Index('idx_parts_attributes_snapshot_gin', ['attributesSnapshot'])
export class Part extends AbstractBaseEntity {
  @ApiProperty({
    example: 'Резистор SMD 10 кОм 0805 1%',
    description: 'Наименование детали',
  })
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @ApiProperty({
    example: 'RES-0805-10K-1%',
    description: 'Уникальный артикул / парт-номер (SKU)',
  })
  @Column({ type: 'varchar', length: 100, unique: true })
  sku!: string;

  @ApiPropertyOptional({
    example: 'Тонкопленочный чип-резистор общего применения',
    description: 'Описание детали',
  })
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @ApiProperty({
    example: 120,
    description: 'Текущее количество детали на складе (кэш журнала движений)',
  })
  @Column({ name: 'quantity', type: 'integer', default: 0 })
  quantity!: number;

  @ApiPropertyOptional({
    example: '7b8f9e10-1234-4567-89ab-cdef01234567',
    description: 'ID категории детали',
  })
  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId?: string | null;

  @ManyToOne(() => Category, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'category_id' })
  category?: Category | null;

  @ApiProperty({
    type: () => [Tag],
    description: 'Теги / метки детали',
  })
  @ManyToMany(() => Tag)
  @JoinTable({
    name: 'part_tags',
    joinColumn: { name: 'part_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags?: Tag[];

  @ApiProperty({
    type: () => [AttributeValue],
    description: 'Динамические значения EAV-атрибутов',
  })
  @OneToMany(() => AttributeValue, (val) => val.part, { cascade: true })
  attributeValues?: AttributeValue[];

  @ApiProperty({
    example: { nominal_voltage: 12, package_type: 'smd_0805' },
    description: 'Денормализованный снимок всех атрибутов для быстрого поиска',
  })
  @Column({
    name: 'attributes_snapshot',
    type: 'jsonb',
    default: () => "'{}'",
  })
  attributesSnapshot!: Record<string, unknown>;
}
