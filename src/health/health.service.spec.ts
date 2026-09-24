import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let mockDataSource: {
    isInitialized: boolean;
    query: jest.Mock;
  };
  let mockConfigService: {
    get: jest.Mock;
  };

  beforeEach(async () => {
    mockDataSource = {
      isInitialized: true,
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'test';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getLiveness', () => {
    it('should return status "ok" with ISO timestamp', () => {
      const result = service.getLiveness();
      expect(result.status).toBe('ok');
      expect(typeof result.timestamp).toBe('string');
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });

  describe('checkDatabase', () => {
    it('should return status "up" with latency when query succeeds', async () => {
      const result = await service.checkDatabase();
      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
      expect(result.status).toBe('up');
      expect(typeof result.latencyMs).toBe('number');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('should return status "down" when dataSource is not initialized', async () => {
      mockDataSource.isInitialized = false;
      const result = await service.checkDatabase();
      expect(result.status).toBe('down');
      expect(typeof result.latencyMs).toBe('number');
      expect(result.error).toBe('Database connection is not initialized');
    });

    it('should return status "down" when query throws an error', async () => {
      mockDataSource.query.mockRejectedValueOnce(new Error('Connection lost'));
      const result = await service.checkDatabase();
      expect(result.status).toBe('down');
      expect(typeof result.latencyMs).toBe('number');
      expect(result.error).toBe('Connection lost');
    });
  });

  describe('checkMemory', () => {
    it('should return memory metrics with status "up"', () => {
      const result = service.checkMemory();
      expect(result.status).toBe('up');
      expect(typeof result.heapUsedBytes).toBe('number');
      expect(typeof result.heapTotalBytes).toBe('number');
      expect(typeof result.rssBytes).toBe('number');
      expect(result.heapUsedBytes).toBeGreaterThan(0);
    });
  });

  describe('getReadiness', () => {
    it('should return status "ok" when database is up', async () => {
      const result = await service.getReadiness();
      expect(result.status).toBe('ok');
      expect(result.database).toBe('up');
      expect(typeof result.timestamp).toBe('string');
      expect(result.error).toBeUndefined();
    });

    it('should return status "error" when database is down', async () => {
      mockDataSource.query.mockRejectedValueOnce(new Error('DB unreachable'));
      const result = await service.getReadiness();
      expect(result.status).toBe('error');
      expect(result.database).toBe('down');
      expect(result.error).toBe('DB unreachable');
    });
  });

  describe('getHealth', () => {
    it('should return overall status "ok" when all services are healthy', async () => {
      const result = await service.getHealth();
      expect(result.status).toBe('ok');
      expect(result.environment).toBe('test');
      expect(result.version).toBeDefined();
      expect(typeof result.uptime).toBe('number');
      expect(result.services.database.status).toBe('up');
      expect(result.services.memory.status).toBe('up');
    });

    it('should return overall status "error" when database fails', async () => {
      mockDataSource.query.mockRejectedValueOnce(new Error('DB failure'));
      const result = await service.getHealth();
      expect(result.status).toBe('error');
      expect(result.services.database.status).toBe('down');
      expect(result.services.database.error).toBe('DB failure');
      expect(result.services.memory.status).toBe('up');
    });
  });
});
