import { Test, TestingModule } from '@nestjs/testing';
import { McpSchemaFormatterService } from './mcp-schema-formatter.service';
import type { OpenAPIObject } from '@nestjs/swagger';

describe('McpSchemaFormatterService', () => {
  let service: McpSchemaFormatterService;

  const mockOpenApiDoc: OpenAPIObject = {
    openapi: '3.0.0',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {},
    components: {
      schemas: {
        SimpleDto: {
          type: 'object',
          required: ['id', 'name'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            name: {
              type: 'string',
              description: 'Item name',
              example: 'Resistor',
            },
            count: { type: 'integer', default: 10 },
            isActive: { type: 'boolean' },
            status: { type: 'string', enum: ['PENDING', 'ACTIVE', 'ARCHIVED'] },
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
        NodeA: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            b: { $ref: '#/components/schemas/NodeB' },
          },
        },
        NodeB: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            a: { $ref: '#/components/schemas/NodeA' },
          },
        },
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [McpSchemaFormatterService],
    }).compile();

    service = module.get<McpSchemaFormatterService>(McpSchemaFormatterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolveRef', () => {
    it('should resolve a valid schema $ref', () => {
      const resolved = service.resolveRef(
        '#/components/schemas/SimpleDto',
        mockOpenApiDoc,
      );
      expect(resolved).toBeDefined();
      expect(
        resolved && typeof resolved === 'object' && 'type' in resolved
          ? resolved.type
          : undefined,
      ).toBe('object');
    });

    it('should return undefined for invalid $ref', () => {
      const resolved = service.resolveRef(
        '#/components/schemas/NonExistent',
        mockOpenApiDoc,
      );
      expect(resolved).toBeUndefined();
    });

    it('should return undefined if document is missing or invalid ref format', () => {
      expect(service.resolveRef('invalid-ref')).toBeUndefined();
      expect(
        service.resolveRef('#/components/schemas/SimpleDto'),
      ).toBeUndefined();
    });
  });

  describe('formatSchemaToTypeScript', () => {
    it('should format simple object schema with required and optional fields', () => {
      const ts = service.formatSchemaToTypeScript(
        { $ref: '#/components/schemas/SimpleDto' },
        mockOpenApiDoc,
      );
      expect(ts).toContain('id: string /* uuid */;');
      expect(ts).toContain('name: string; // Item name | example: "Resistor"');
      expect(ts).toContain('count?: number; // default: 10');
      expect(ts).toContain('isActive?: boolean;');
      expect(ts).toContain("status?: 'PENDING' | 'ACTIVE' | 'ARCHIVED';");
    });

    it('should handle recursive schemas (CategoryTreeDto) without stack overflow', () => {
      const ts = service.formatSchemaToTypeScript(
        { $ref: '#/components/schemas/CategoryTreeDto' },
        mockOpenApiDoc,
      );
      expect(ts).toContain('id: string /* uuid */;');
      expect(ts).toContain('name: string;');
      expect(ts).toContain(
        'CategoryTreeDto /* [Circular ref to #/components/schemas/CategoryTreeDto] */',
      );
    });

    it('should handle mutually cyclic schemas (NodeA -> NodeB -> NodeA) safely', () => {
      const ts = service.formatSchemaToTypeScript(
        { $ref: '#/components/schemas/NodeA' },
        mockOpenApiDoc,
      );
      expect(ts).toContain(
        'NodeA /* [Circular ref to #/components/schemas/NodeA] */',
      );
    });

    it('should respect maxDepth constraint', () => {
      const ts = service.formatSchemaToTypeScript(
        { $ref: '#/components/schemas/NodeA' },
        mockOpenApiDoc,
        { maxDepth: 1 },
      );
      expect(ts).toContain('[Max depth reached]');
    });

    it('should format union types (oneOf / anyOf / allOf)', () => {
      const oneOfTs = service.formatSchemaToTypeScript({
        oneOf: [{ type: 'string' }, { type: 'number' }],
      });
      expect(oneOfTs).toBe('(string | number)');

      const allOfTs = service.formatSchemaToTypeScript({
        allOf: [{ type: 'string' }, { type: 'number' }],
      });
      expect(allOfTs).toBe('string & number');
    });
  });

  describe('generateExampleJson', () => {
    it('should generate realistic sample JSON for SimpleDto', () => {
      const example = service.generateExampleJson(
        { $ref: '#/components/schemas/SimpleDto' },
        mockOpenApiDoc,
      ) as Record<string, unknown>;

      expect(example).toBeDefined();
      expect(example.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(example.name).toBe('Resistor');
      expect(example.count).toBe(10);
      expect(example.isActive).toBe(true);
      expect(example.status).toBe('PENDING');
    });

    it('should handle recursive schemas in example JSON generation without infinite loop', () => {
      const example = service.generateExampleJson(
        { $ref: '#/components/schemas/CategoryTreeDto' },
        mockOpenApiDoc,
      );

      expect(example).toBeDefined();
      const children =
        example && typeof example === 'object' && 'children' in example
          ? example.children
          : undefined;
      expect(children).toEqual(['[Circular Reference to CategoryTreeDto]']);
    });
  });

  describe('formatParametersTable', () => {
    it('should format query and path parameters into Markdown table', () => {
      const table = service.formatParametersTable([
        {
          name: 'page',
          in: 'query',
          description: 'Page number',
          required: false,
          schema: { type: 'integer', default: 1 },
        },
        {
          name: 'id',
          in: 'path',
          description: 'Entity ID',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ]);

      expect(table).toContain(
        '| `page` | `query` | `number` | Нет | `1` | Page number |',
      );
      expect(table).toContain(
        '| `id` | `path` | `string /* uuid */` | **Да** | - | Entity ID |',
      );
    });

    it('should return empty notice if no parameters given', () => {
      expect(service.formatParametersTable([])).toContain(
        'Параметры отсутствуют',
      );
    });
  });

  describe('extractSchemaSearchText', () => {
    it('should extract property names and descriptions for search index', () => {
      const tokens = service.extractSchemaSearchText(
        { $ref: '#/components/schemas/SimpleDto' },
        mockOpenApiDoc,
      );

      expect(tokens).toContain('SimpleDto');
      expect(tokens).toContain('name');
      expect(tokens).toContain('Item name');
      expect(tokens).toContain('status');
      expect(tokens).toContain('PENDING');
    });

    it('should not infinite loop on recursive schemas', () => {
      const tokens = service.extractSchemaSearchText(
        { $ref: '#/components/schemas/CategoryTreeDto' },
        mockOpenApiDoc,
      );

      expect(tokens).toContain('CategoryTreeDto');
      expect(tokens).toContain('children');
    });
  });
});
