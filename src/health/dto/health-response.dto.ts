import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DatabaseHealthDto {
  @ApiProperty({
    enum: ['up', 'down'],
    example: 'up',
    description: 'Database connection status',
  })
  status!: 'up' | 'down';

  @ApiProperty({
    example: 4,
    description: 'Database query response time in milliseconds',
  })
  latencyMs!: number;

  @ApiPropertyOptional({
    example: 'Connection timeout',
    description: 'Error message if database check failed',
  })
  error?: string;
}

export class MemoryHealthDto {
  @ApiProperty({
    enum: ['up', 'down'],
    example: 'up',
    description: 'Process memory status',
  })
  status!: 'up' | 'down';

  @ApiProperty({
    example: 45283920,
    description: 'Heap memory currently used in bytes',
  })
  heapUsedBytes!: number;

  @ApiProperty({
    example: 68423680,
    description: 'Total heap memory allocated in bytes',
  })
  heapTotalBytes!: number;

  @ApiProperty({
    example: 102760448,
    description: 'Resident Set Size memory in bytes',
  })
  rssBytes!: number;
}

export class HealthServicesDto {
  @ApiProperty({
    type: () => DatabaseHealthDto,
    description: 'Database health status',
  })
  database!: DatabaseHealthDto;

  @ApiProperty({
    type: () => MemoryHealthDto,
    description: 'Memory usage metrics',
  })
  memory!: MemoryHealthDto;
}

export class HealthResponseDto {
  @ApiProperty({
    enum: ['ok', 'error'],
    example: 'ok',
    description: 'Overall system health status',
  })
  status!: 'ok' | 'error';

  @ApiProperty({
    example: '2026-03-30T10:00:00.000Z',
    description: 'Current ISO 8601 timestamp',
  })
  timestamp!: string;

  @ApiProperty({
    example: 3600.5,
    description: 'Process uptime in seconds',
  })
  uptime!: number;

  @ApiProperty({
    example: '0.0.1',
    description: 'Application version',
  })
  version!: string;

  @ApiProperty({
    example: 'production',
    description: 'Current runtime environment',
  })
  environment!: string;

  @ApiProperty({
    type: () => HealthServicesDto,
    description: 'Individual subsystem health reports',
  })
  services!: HealthServicesDto;
}

export class LivenessResponseDto {
  @ApiProperty({
    example: 'ok',
    description: 'Liveness status',
  })
  status!: 'ok';

  @ApiProperty({
    example: '2026-03-30T10:00:00.000Z',
    description: 'Current ISO 8601 timestamp',
  })
  timestamp!: string;
}

export class ReadinessResponseDto {
  @ApiProperty({
    enum: ['ok', 'error'],
    example: 'ok',
    description: 'Readiness status to receive traffic',
  })
  status!: 'ok' | 'error';

  @ApiProperty({
    example: '2026-03-30T10:00:00.000Z',
    description: 'Current ISO 8601 timestamp',
  })
  timestamp!: string;

  @ApiProperty({
    enum: ['up', 'down'],
    example: 'up',
    description: 'Database readiness status',
  })
  database!: 'up' | 'down';

  @ApiPropertyOptional({
    example: 'Connection refused',
    description: 'Error details if readiness check failed',
  })
  error?: string;
}
