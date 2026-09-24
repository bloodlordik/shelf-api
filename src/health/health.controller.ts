import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service';
import {
  HealthResponseDto,
  LivenessResponseDto,
  ReadinessResponseDto,
} from './dto/health-response.dto';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Get full health status of the application and its dependencies',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'System is healthy and all dependencies are up',
    type: HealthResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'System is unhealthy or a required dependency is down',
    type: HealthResponseDto,
  })
  async getHealth(
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthResponseDto> {
    const health = await this.healthService.getHealth();
    if (health.status !== 'ok') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return health;
  }

  @Get('live')
  @ApiOperation({
    summary: 'Liveness probe to check if the application process is running',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Application is alive',
    type: LivenessResponseDto,
  })
  getLiveness(): LivenessResponseDto {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  @ApiOperation({
    summary:
      'Readiness probe to check if the application is ready to accept traffic',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Application is ready to handle requests',
    type: ReadinessResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Application is not ready to handle requests',
    type: ReadinessResponseDto,
  })
  async getReadiness(
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReadinessResponseDto> {
    const readiness = await this.healthService.getReadiness();
    if (readiness.status !== 'ok') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return readiness;
  }
}
