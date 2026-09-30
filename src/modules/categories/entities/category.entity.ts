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

@Entity('categories')
@Index('idx_categories_parent_id', ['parentId'])
@Index('idx_categories_code', ['code'], {
  unique: true,
  where: 'code IS NOT NULL',
})
export class Category extends AbstractBaseEntity {
  @ApiProperty({
    example: 'Резисторы SMD',
    description: 'Название категории',
  })
  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @ApiPropertyOptional({
    example: 'resistors_smd',
    description: 'Уникальный код категории',
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  code?: string | null;

  @ApiPropertyOptional({
    example: '7b8f9e10-1234-4567-89ab-cdef01234567',
    description: 'ID родительской категории',
  })
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId?: string | null;

  @ManyToOne(() => Category, (category) => category.children, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parent?: Category | null;

  @OneToMany(() => Category, (category) => category.parent)
  children?: Category[];
}
