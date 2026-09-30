import { Test, TestingModule } from '@nestjs/testing';
import { McpService } from './mcp.service';
import { McpSchemaFormatterService } from './mcp-schema-formatter.service';
import type { OpenAPIObject } from '@nestjs/swagger';
import { MCP_ERROR_CODES } from '../interfaces/mcp.interfaces';

describe('McpService', () => {
  let service: McpService;

  const mockOpenApiDoc: OpenAPIObject = {
    openapi: '3.0.0',
    info: { title: 'Shelf API', version: '1.0.0' },
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
          parameters: [],
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [McpService, McpSchemaFormatterService],
    }).compile();

    service = module.get<McpService>(McpService);
    service.setOpenApiDocument(mockOpenApiDoc);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getToolDefinitions', () => {
    it('should return 4 tool definitions (help, index, describe, search)', () => {
      const tools = service.getToolDefinitions();
      expect(tools).toHaveLength(4);
      const names = tools.map((t) => t.name);
      expect(names).toEqual(['help', 'index', 'describe', 'search']);
    });
  });

  describe('executeTool', () => {
    it('should execute help tool and return Markdown guide', () => {
      const result = service.executeTool('help', {});
      expect(result.isError).toBeFalsy();
      expect(result.content[0]?.text).toContain('# Руководство по Shelf API');
    });

    it('should execute help tool with pagination topic', () => {
      const result = service.executeTool('help', { topic: 'pagination' });
      expect(result.content[0]?.text).toContain('# Пагинация в Shelf API');
      expect(result.content[0]?.text).toContain('PaginatedResponseDto');
    });

    it('should execute help tool with actors topic', () => {
      const result = service.executeTool('help', { topic: 'actors' });
      expect(result.content[0]?.text).toContain(
        '# Учет акторов (Actors) в Shelf API',
      );
      expect(result.content[0]?.text).toContain('actorId: number');
    });

    it('should execute index tool and group by tags', () => {
      const result = service.executeTool('index', {});
      expect(result.content[0]?.text).toContain(
        '# Каталог эндпоинтов Shelf API',
      );
      expect(result.content[0]?.text).toContain('## Домен: parts');
      expect(result.content[0]?.text).toContain('## Домен: stock');
      expect(result.content[0]?.text).toContain('## Домен: categories');
    });

    it('should execute index tool with tag filter', () => {
      const result = service.executeTool('index', { tag: 'stock' });
      expect(result.content[0]?.text).toContain('## Домен: stock');
      expect(result.content[0]?.text).not.toContain('## Домен: categories');
    });

    it('should execute describe tool by path and method', () => {
      const result = service.executeTool('describe', {
        path: '/parts',
        method: 'POST',
      });
      expect(result.content[0]?.text).toContain('# POST /parts');
      expect(result.content[0]?.text).toContain('Create a new part');
      expect(result.content[0]?.text).toContain('CreatePartDto');
      expect(result.content[0]?.text).toContain('STM32F103C8T6');
      expect(result.content[0]?.text).toContain('curl -X POST');
    });

    it('should execute describe tool on recursive category tree', () => {
      const result = service.executeTool('describe', {
        path: '/categories/tree',
        method: 'GET',
      });
      expect(result.content[0]?.text).toContain('# GET /categories/tree');
      expect(result.content[0]?.text).toContain(
        'CategoryTreeDto /* [Circular ref to #/components/schemas/CategoryTreeDto] */',
      );
    });

    it('should execute search tool finding endpoints by keyword', () => {
      const result = service.executeTool('search', { query: 'movement' });
      expect(result.content[0]?.text).toContain(
        '# Результаты поиска по запросу "movement"',
      );
      expect(result.content[0]?.text).toContain('/stock/movements');
    });

    it('should search inside schema fields (e.g. partNumber)', () => {
      const result = service.executeTool('search', {
        query: 'partNumber',
      });
      expect(result.content[0]?.text).toContain('/parts');
      expect(result.content[0]?.text).toContain('Совпадение в схеме');
    });

    it('should return error result for unknown tool', () => {
      const result = service.executeTool('nonExistentTool', {});
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Неизвестный инструмент');
    });
  });

  describe('handleJsonRpc', () => {
    it('should handle "initialize" method', () => {
      const response = service.handleJsonRpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      const res =
        response.result &&
        typeof response.result === 'object' &&
        'serverInfo' in response.result
          ? (response.result as {
              serverInfo: { name: string; version: string };
            })
          : undefined;
      expect(res?.serverInfo?.name).toBe('shelf-api-mcp');
    });

    it('should handle "ping" method', () => {
      const response = service.handleJsonRpc({
        jsonrpc: '2.0',
        id: 'ping-1',
        method: 'ping',
      });

      expect(response.result).toEqual({});
    });

    it('should handle "tools/list" method', () => {
      const response = service.handleJsonRpc({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      });

      const res =
        response.result &&
        typeof response.result === 'object' &&
        'tools' in response.result
          ? (response.result as { tools: unknown[] })
          : undefined;
      expect(res?.tools).toHaveLength(4);
    });

    it('should handle "tools/call" method for search', () => {
      const response = service.handleJsonRpc({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'search',
          arguments: { query: 'movement' },
        },
      });

      const res =
        response.result &&
        typeof response.result === 'object' &&
        'content' in response.result
          ? (response.result as {
              content: Array<{ type: string; text: string }>;
            })
          : undefined;
      expect(res?.content[0]?.text).toContain('/stock/movements');
    });

    it('should return METHOD_NOT_FOUND error for unknown JSON-RPC method', () => {
      const response = service.handleJsonRpc({
        jsonrpc: '2.0',
        id: 4,
        method: 'unknown/method',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(MCP_ERROR_CODES.METHOD_NOT_FOUND);
    });
  });
});
