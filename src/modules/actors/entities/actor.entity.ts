import {
  Entity,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('actors')
export class Actor {
  @ApiProperty({
    example: 42,
    description:
      'Внешний целочисленный идентификатор пользователя/сервиса (INT)',
  })
  @PrimaryColumn({ type: 'integer' })
  id!: number;

  @ApiProperty({
    example: '2026-09-24T10:00:00.000Z',
    description: 'Дата первой фиксации актора в системе',
  })
  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @ApiProperty({
    example: '2026-09-24T12:00:00.000Z',
    description: 'Дата последней активности актора',
  })
  @UpdateDateColumn({
    name: 'last_seen_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  lastSeenAt!: Date;
}
