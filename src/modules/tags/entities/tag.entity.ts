import { Entity, Column, Index } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AbstractBaseEntity } from '../../../common/entities/abstract-base.entity';

@Entity('tags')
@Index('idx_tags_name', ['name'], { unique: true })
export class Tag extends AbstractBaseEntity {
  @ApiProperty({
    example: 'SMD',
    description: 'Название тега/метки',
  })
  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string;

  @ApiPropertyOptional({
    example: '#3B82F6',
    description: 'Цвет метки (HEX или CSS-токен)',
  })
  @Column({ type: 'varchar', length: 30, nullable: true })
  color?: string | null;
}
