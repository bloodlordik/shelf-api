import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export abstract class AbstractBaseEntity {
  @ApiProperty({
    example: '7b8f9e10-1234-4567-89ab-cdef01234567',
    description: 'Уникальный идентификатор (UUID)',
  })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({
    example: '2026-09-24T10:00:00.000Z',
    description: 'Дата и время создания',
  })
  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @ApiProperty({
    example: '2026-09-24T10:00:00.000Z',
    description: 'Дата и время последнего обновления',
  })
  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;
}
