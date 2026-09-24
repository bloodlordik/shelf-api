import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import {
  HealthResponseDto,
  LivenessResponseDto,
  ReadinessResponseDto,
} from './dto/health-response.dto';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: {
    getLiveness: jest.MockedFunction<() => LivenessResponseDto>;
    getReadiness: jest.MockedFunction<() => Promise<ReadinessResponseDto>>;
    getHealth: jest.MockedFunction<() => Promise<HealthResponseDto>>;
  };
  let mockResponse: {
    status: jest.MockedFunction<(code: number) => Response>;
  };

  beforeEach(async () => {
    healthService = {
      getLiveness: jest.fn<LivenessResponseDto, []>(),
      getReadiness: jest.fn<Promise<ReadinessResponseDto>, []>(),
      getHealth: jest.fn<Promise<HealthResponseDto>, []>(),
    };

    const statusMock = jest.fn<Response, [number]>();
    statusMock.mockReturnThis();

    mockResponse = {
      status: statusMock,
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: healthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getLiveness', () => {
    it('should return liveness DTO', () => {
      const mockResult: LivenessResponseDto = {
        status: 'ok',
        timestamp: new Date().toISOString(),
      };
      healthService.getLiveness.mockReturnValue(mockResult);

      const result = controller.getLiveness();
      expect(result).toEqual(mockResult);
      expect(healthService.getLiveness).toHaveBeenCalledTimes(1);
    });
  });

  describe('getReadiness', () => {
    it('should return readiness DTO without setting 503 when status is ok', async () => {
      const mockResult: ReadinessResponseDto = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'up',
      };
      healthService.getReadiness.mockResolvedValue(mockResult);

      const result = await controller.getReadiness(
        mockResponse as unknown as Response,
      );
      expect(result).toEqual(mockResult);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should set HTTP 503 when status is error', async () => {
      const mockResult: ReadinessResponseDto = {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'down',
        error: 'Database connection failed',
      };
      healthService.getReadiness.mockResolvedValue(mockResult);

      const result = await controller.getReadiness(
        mockResponse as unknown as Response,
      );
      expect(result).toEqual(mockResult);
      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    });
  });

  describe('getHealth', () => {
    it('should return health DTO without setting 503 when status is ok', async () => {
      const mockResult: HealthResponseDto = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: 120,
        version: '0.0.1',
        environment: 'test',
        services: {
          database: { status: 'up', latencyMs: 5 },
          memory: {
            status: 'up',
            heapUsedBytes: 1000,
            heapTotalBytes: 2000,
            rssBytes: 3000,
          },
        },
      };
      healthService.getHealth.mockResolvedValue(mockResult);

      const result = await controller.getHealth(
        mockResponse as unknown as Response,
      );
      expect(result).toEqual(mockResult);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should set HTTP 503 when status is error', async () => {
      const mockResult: HealthResponseDto = {
        status: 'error',
        timestamp: new Date().toISOString(),
        uptime: 120,
        version: '0.0.1',
        environment: 'test',
        services: {
          database: { status: 'down', latencyMs: 5, error: 'DB down' },
          memory: {
            status: 'up',
            heapUsedBytes: 1000,
            heapTotalBytes: 2000,
            rssBytes: 3000,
          },
        },
      };
      healthService.getHealth.mockResolvedValue(mockResult);

      const result = await controller.getHealth(
        mockResponse as unknown as Response,
      );
      expect(result).toEqual(mockResult);
      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    });
  });
});
