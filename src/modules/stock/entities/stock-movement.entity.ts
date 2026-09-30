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
import { Part } from '../../parts/entities/part.entity';
import { Actor } from '../../actors/entities/actor.entity';
import { StockMovementType } from '../enums/stock-movement-type.enum';

@Entity('stock_movements')
@Index('idx_stock_movements_part_perf_at', ['partId', 'performedAt'])
@Index('idx_stock_movements_perf_at', ['performedAt'])
@Index('idx_stock_movements_performed_by', ['performedBy', 'performedAt'])
@Index('idx_stock_movements_type', ['movementType', 'performedAt'])
@Index('idx_stock_movements_ref_doc', ['referenceDoc'])
export class StockMovement {
  @ApiProperty({ example: '7b8f9e10-1234-4567-89ab-cdef01234567' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ example: '7b8f9e10-1234-4567-89ab-cdef01234567' })
  @Column({ name: 'part_id', type: 'uuid' })
  partId!: string;

  @ManyToOne(() => Part, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'part_id' })
  part!: Part;

  @ApiProperty({ enum: StockMovementType, example: StockMovementType.RECEIPT })
  @Column({
    name: 'movement_type',
    type: 'varchar',
    length: 30,
  })
  movementType!: StockMovementType;

  @ApiProperty({
    example: 50,
    description: 'Изменение количества со знаком (+50 приход, -20 списание)',
  })
  @Column({ name: 'quantity_delta', type: 'integer' })
  quantityDelta!: number;

  @ApiProperty({
    example: 120,
    description:
      'Итоговый остаток на складе сразу после фиксации данного движения',
  })
  @Column({ name: 'quantity_after', type: 'integer' })
  quantityAfter!: number;

  @ApiPropertyOptional({ example: 'Поступление по накладной' })
  @Column({ name: 'reason', type: 'varchar', length: 500, nullable: true })
  reason?: string | null;

  @ApiPropertyOptional({ example: 'ТТН-2026-09-00123' })
  @Column({
    name: 'reference_doc',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  referenceDoc?: string | null;

  @ApiProperty({ example: 42, description: 'Целочисленный ID актора' })
  @Column({ name: 'performed_by', type: 'integer' })
  performedBy!: number;

  @ManyToOne(() => Actor, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'performed_by' })
  actor!: Actor;

  @ApiProperty({ example: '2026-09-24T10:00:00.000Z' })
  @CreateDateColumn({
    name: 'performed_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  performedAt!: Date;
}
