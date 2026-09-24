import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  DatabaseHealthDto,
  HealthResponseDto,
  LivenessResponseDto,
  MemoryHealthDto,
  ReadinessResponseDto,
} from './dto/health-response.dto';

@Injectable()
export class HealthService {
  constructor(
    @Optional() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  getLiveness(): LivenessResponseDto {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async checkDatabase(): Promise<DatabaseHealthDto> {
    const start = Date.now();
    try {
      if (!this.dataSource || !this.dataSource.isInitialized) {
        throw new Error('Database connection is not initialized');
      }
      await this.dataSource.query('SELECT 1');
      return {
        status: 'up',
        latencyMs: Math.max(0, Date.now() - start),
      };
    } catch (error: unknown) {
      return {
        status: 'down',
        latencyMs: Math.max(0, Date.now() - start),
        error: error instanceof Error ? error.message : 'Database check failed',
      };
    }
  }

  checkMemory(): MemoryHealthDto {
    const mem = process.memoryUsage();
    return {
      status: 'up',
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
      rssBytes: mem.rss,
    };
  }

  async getReadiness(): Promise<ReadinessResponseDto> {
    const dbHealth = await this.checkDatabase();
    const timestamp = new Date().toISOString();

    if (dbHealth.status === 'up') {
      return {
        status: 'ok',
        timestamp,
        database: 'up',
      };
    }

    return {
      status: 'error',
      timestamp,
      database: 'down',
      error: dbHealth.error,
    };
  }

  async getHealth(): Promise<HealthResponseDto> {
    const dbHealth = await this.checkDatabase();
    const memoryHealth = this.checkMemory();

    const overallStatus: 'ok' | 'error' =
      dbHealth.status === 'up' ? 'ok' : 'error';
    const environment =
      this.configService.get<string>('NODE_ENV') ||
      process.env.NODE_ENV ||
      'development';
    const version = process.env.npm_package_version || '0.0.1';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version,
      environment,
      services: {
        database: dbHealth,
        memory: memoryHealth,
      },
    };
  }
}
