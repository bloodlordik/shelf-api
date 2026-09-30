import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AbstractBaseEntity } from '../../../common/entities/abstract-base.entity';
import { UnitGroup } from '../enums/unit-group.enum';

@Entity('units')
export class Unit extends AbstractBaseEntity {
  @ApiProperty({
    example: 'Миллиметр',
    description: 'Полное название единицы измерения',
  })
  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @ApiProperty({
    example: 'мм',
    description: 'Обозначение (символ) единицы измерения',
  })
  @Column({ type: 'varchar', length: 20 })
  symbol!: string;

  @ApiProperty({
    enum: UnitGroup,
    example: UnitGroup.LENGTH,
    description: 'Категория/группа единиц измерения',
  })
  @Column({
    type: 'enum',
    enum: UnitGroup,
    default: UnitGroup.OTHER,
  })
  group!: UnitGroup;
}
