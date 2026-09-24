import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import {
  HealthResponseDto,
  LivenessResponseDto,
  ReadinessResponseDto,
} from '../src/health/dto/health-response.dto';

describe('App & Health Endpoints (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/api/v1 (GET)', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1');
    expect(response.status).toBe(200);
    expect(response.text).toBe('Hello World!');
  });

  describe('Health Endpoints', () => {
    it('/api/v1/health/live (GET) should return 200 and liveness status', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/health/live',
      );

      expect(response.status).toBe(200);
      const body = response.body as LivenessResponseDto;
      expect(body.status).toBe('ok');
      expect(typeof body.timestamp).toBe('string');
    });

    it('/api/v1/health/ready (GET) should return readiness status', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/health/ready',
      );

      expect([200, 503]).toContain(response.status);
      const body = response.body as ReadinessResponseDto;
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('database');
      expect(['ok', 'error']).toContain(body.status);
      expect(['up', 'down']).toContain(body.database);
    });

    it('/api/v1/health (GET) should return detailed health response', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/health');

      expect([200, 503]).toContain(response.status);
      const body = response.body as HealthResponseDto;
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('uptime');
      expect(body).toHaveProperty('version');
      expect(body).toHaveProperty('environment');
      expect(body).toHaveProperty('services');
      expect(body.services).toHaveProperty('database');
      expect(body.services.memory.status).toBe('up');
      expect(typeof body.services.memory.heapUsedBytes).toBe('number');
      expect(typeof body.services.memory.heapTotalBytes).toBe('number');
      expect(typeof body.services.memory.rssBytes).toBe('number');
    });
  });
});
