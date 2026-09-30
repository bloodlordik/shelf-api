import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';
import type { OpenAPIObject } from '@nestjs/swagger';
import { McpModule } from '../src/modules/mcp/mcp.module';
import { McpService } from '../src/modules/mcp/services/mcp.service';
import {
  McpResponse,
  McpInitializeResult,
  McpToolCallResult,
  McpToolDefinition,
} from '../src/modules/mcp/interfaces/mcp.interfaces';
import {
  McpMarkdownResponse,
  McpToolsListResponse,
  McpExecuteToolResponse,
} from '../src/modules/mcp/mcp.controller';

describe('MCP Module (e2e)', () => {
  let app: INestApplication<App>;
  let mcpService: McpService;
  let serverUrl: string;

  const mockOpenApiDoc: OpenAPIObject = {
    openapi: '3.0.0',
    info: { title: 'Shelf API', version: '1.0' },
    paths: {
      '/parts': {
        get: {
          summary: 'Get list of parts',
          description: 'Returns paginated list of electronic components',
          operationId: 'PartsController_findAll',
          tags: ['parts'],
          parameters: [
            {
              name: 'page',
              in: 'query',
              description: 'Page number',
              schema: { type: 'integer', default: 1 },
            },
          ],
          responses: {
            '200': {
              description: 'Paginated list of parts',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/PartCardDto' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          summary: 'Create a new part',
          operationId: 'PartsController_create',
          tags: ['parts'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreatePartDto' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Part successfully created',
            },
          },
        },
      },
      '/stock/movements': {
        post: {
          summary: 'Create stock movement',
          operationId: 'StockController_createMovement',
          tags: ['stock'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateStockMovementDto' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Stock movement recorded',
            },
          },
        },
      },
      '/categories/tree': {
        get: {
          summary: 'Get category tree',
          operationId: 'CategoriesController_getTree',
          tags: ['categories'],
          responses: {
            '200': {
              description: 'Hierarchical category tree',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/CategoryTreeDto' },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        CreatePartDto: {
          type: 'object',
          required: ['name', 'categoryId'],
          properties: {
            name: { type: 'string', example: 'STM32F103C8T6' },
            partNumber: { type: 'string', example: 'STM32-001' },
            categoryId: { type: 'string', format: 'uuid' },
          },
        },
        PartCardDto: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
          },
        },
        CreateStockMovementDto: {
          type: 'object',
          required: ['partId', 'type', 'quantity', 'actorId'],
          properties: {
            partId: { type: 'string', format: 'uuid' },
            type: {
              type: 'string',
              enum: ['IN', 'OUT', 'ADJUSTMENT', 'INITIAL', 'TRANSFER'],
            },
            quantity: { type: 'number', example: 100 },
            actorId: { type: 'integer', example: 1 },
          },
        },
        CategoryTreeDto: {
          type: 'object',
          required: ['id', 'name', 'children'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            children: {
              type: 'array',
              items: { $ref: '#/components/schemas/CategoryTreeDto' },
            },
          },
        },
      },
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), McpModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });

    mcpService = app.get(McpService);
    mcpService.setOpenApiDocument(mockOpenApiDoc);

    await app.init();
    await app.listen(0);
    serverUrl = await app.getUrl();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('JSON-RPC 2.0 (POST /api/v1/mcp)', () => {
    it('should handle "initialize" method', async () => {
      const response = await request(serverUrl)
        .post('/api/v1/mcp')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
        })
        .expect(200);

      const body = response.body as McpResponse<McpInitializeResult>;
      expect(body.jsonrpc).toBe('2.0');
      expect(body.id).toBe(1);
      expect(body.result?.protocolVersion).toBe('2024-11-05');
      expect(body.result?.serverInfo.name).toBe('shelf-api-mcp');
      expect(body.result?.capabilities.tools).toBeDefined();
    });

    it('should handle "ping" method', async () => {
      const response = await request(serverUrl)
        .post('/api/v1/mcp')
        .send({
          jsonrpc: '2.0',
          id: 'ping-42',
          method: 'ping',
        })
        .expect(200);

      const body = response.body as McpResponse;
      expect(body.jsonrpc).toBe('2.0');
      expect(body.id).toBe('ping-42');
      expect(body.result).toEqual({});
    });

    it('should handle "tools/list" method returning 4 tools', async () => {
      const response = await request(serverUrl)
        .post('/api/v1/mcp')
        .send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
        })
        .expect(200);

      const body = response.body as McpResponse<{ tools: McpToolDefinition[] }>;
      expect(body.result?.tools).toHaveLength(4);
      const names = body.result?.tools.map((t) => t.name);
      expect(names).toEqual(['help', 'index', 'describe', 'search']);
    });

    it('should execute "help" tool via tools/call', async () => {
      const response = await request(serverUrl)
        .post('/api/v1/mcp')
        .send({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'help',
            arguments: { topic: 'stock' },
          },
        })
        .expect(200);

      const body = response.body as McpResponse<McpToolCallResult>;
      expect(body.result?.content[0]?.text).toContain(
        '# Складской учет и движения',
      );
      expect(body.result?.content[0]?.text).toContain('StockMovementType');
    });

    it('should execute "index" tool via tools/call', async () => {
      const response = await request(serverUrl)
        .post('/api/v1/mcp')
        .send({
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'index',
            arguments: {},
          },
        })
        .expect(200);

      const body = response.body as McpResponse<McpToolCallResult>;
      expect(body.result?.content[0]?.text).toContain(
        '# Каталог эндпоинтов Shelf API',
      );
      expect(body.result?.content[0]?.text).toContain('/parts');
    });

    it('should execute "describe" tool via tools/call for recursive category tree', async () => {
      const response = await request(serverUrl)
        .post('/api/v1/mcp')
        .send({
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/call',
          params: {
            name: 'describe',
            arguments: { path: '/categories/tree', method: 'GET' },
          },
        })
        .expect(200);

      const body = response.body as McpResponse<McpToolCallResult>;
      expect(body.result?.content[0]?.text).toContain('# GET /categories/tree');
      expect(body.result?.content[0]?.text).toContain('CategoryTreeDto');
      expect(body.result?.content[0]?.text).toContain('[Circular ref');
    });

    it('should execute "search" tool via tools/call', async () => {
      const response = await request(serverUrl)
        .post('/api/v1/mcp')
        .send({
          jsonrpc: '2.0',
          id: 6,
          method: 'tools/call',
          params: {
            name: 'search',
            arguments: { query: 'part' },
          },
        })
        .expect(200);

      const body = response.body as McpResponse<McpToolCallResult>;
      expect(body.result?.content[0]?.text).toContain(
        '# Результаты поиска по запросу "part"',
      );
      expect(body.result?.content[0]?.text).toContain('/parts');
    });

    it('should return error on unknown JSON-RPC method', async () => {
      const response = await request(serverUrl)
        .post('/api/v1/mcp')
        .send({
          jsonrpc: '2.0',
          id: 7,
          method: 'nonExistentMethod',
        })
        .expect(200);

      const body = response.body as McpResponse;
      expect(body.error).toBeDefined();
      expect(body.error?.code).toBe(-32601);
    });
  });

  describe('REST Tool Helpers', () => {
    it('GET /api/v1/mcp/tools should list all tools', async () => {
      const response = await request(serverUrl)
        .get('/api/v1/mcp/tools')
        .expect(200);

      const body = response.body as McpToolsListResponse;
      expect(body.tools).toHaveLength(4);
    });

    it('POST /api/v1/mcp/tools/:toolName should execute tool', async () => {
      const response = await request(serverUrl)
        .post('/api/v1/mcp/tools/help')
        .send({ arguments: { topic: 'pagination' } })
        .expect(200);

      const body = response.body as McpExecuteToolResponse;
      expect(body.tool).toBe('help');
      expect(body.markdown).toContain('Пагинация в Shelf API');
    });

    it('GET /api/v1/mcp/help should return markdown guide', async () => {
      const response = await request(serverUrl)
        .get('/api/v1/mcp/help')
        .expect(200);

      const body = response.body as McpMarkdownResponse;
      expect(body.markdown).toContain('# Руководство по Shelf API');
    });

    it('GET /api/v1/mcp/index should return endpoint index', async () => {
      const response = await request(serverUrl)
        .get('/api/v1/mcp/index')
        .expect(200);

      const body = response.body as McpMarkdownResponse;
      expect(body.markdown).toContain('# Каталог эндпоинтов Shelf API');
      expect(body.markdown).toContain(
        '| Метод | Путь | Описание (Summary) | Operation ID |',
      );
    });

    it('GET /api/v1/mcp/describe should describe endpoint', async () => {
      const response = await request(serverUrl)
        .get('/api/v1/mcp/describe')
        .query({ path: '/parts', method: 'GET' })
        .expect(200);

      const body = response.body as McpMarkdownResponse;
      expect(body.markdown).toContain('# GET /parts');
      expect(body.markdown).toContain('TypeScript');
      expect(body.markdown).toContain('curl');
    });

    it('GET /api/v1/mcp/search should search endpoints', async () => {
      const response = await request(serverUrl)
        .get('/api/v1/mcp/search')
        .query({ query: 'movement' })
        .expect(200);

      const body = response.body as McpMarkdownResponse;
      expect(body.markdown).toContain(
        '# Результаты поиска по запросу "movement"',
      );
      expect(body.markdown).toContain('/stock/movements');
    });
  });

  describe('SSE (GET /api/v1/mcp/sse)', () => {
    it('should connect to SSE endpoint', async () => {
      const response = await request(serverUrl)
        .get('/api/v1/mcp/sse')
        .expect('Content-Type', /text\/event-stream/)
        .expect(200);

      expect(response.text).toContain('data: /api/v1/mcp');
    });
  });
});
