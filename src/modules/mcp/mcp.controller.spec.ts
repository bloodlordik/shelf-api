import { Test, TestingModule } from '@nestjs/testing';
import { McpController } from './mcp.controller';
import { McpService } from './services/mcp.service';
import { McpSchemaFormatterService } from './services/mcp-schema-formatter.service';
import type { Response } from 'express';

describe('McpController', () => {
  let controller: McpController;
  let service: McpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [McpController],
      providers: [McpService, McpSchemaFormatterService],
    }).compile();

    controller = module.get<McpController>(McpController);
    service = module.get<McpService>(McpService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  describe('handleJsonRpc', () => {
    it('should process JSON-RPC request', () => {
      const response = controller.handleJsonRpc({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      });
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
    });
  });

  describe('handleSse', () => {
    it('should return an observable with SSE events', (done) => {
      const events: unknown[] = [];
      controller.handleSse().subscribe({
        next: (event) => events.push(event),
        complete: () => {
          expect(events).toHaveLength(2);
          expect(events[0]).toEqual({ type: 'endpoint', data: '/api/v1/mcp' });
          done();
        },
      });
    });
  });

  describe('getTools', () => {
    it('should return list of tools', () => {
      const result = controller.getTools();
      expect(result.tools).toHaveLength(4);
    });
  });

  describe('executeTool', () => {
    it('should execute tool and return markdown', () => {
      const response = controller.executeTool('help', {
        arguments: { topic: 'pagination' },
      });
      expect(response.tool).toBe('help');
      expect(response.markdown).toContain('Пагинация в Shelf API');
    });
  });

  describe('REST helpers', () => {
    it('getHelp should return markdown', () => {
      const res = controller.getHelp({});
      expect(res.markdown).toContain('Руководство по Shelf API');
    });

    it('getIndex should return markdown', () => {
      const res = controller.getIndex({});
      expect(res.markdown).toBeDefined();
    });

    it('getDescribe should return markdown', () => {
      const res = controller.getDescribe({ path: '/parts' });
      expect(res.markdown).toBeDefined();
    });

    it('getSearch should return markdown', () => {
      const res = controller.getSearch({ query: 'parts' });
      expect(res.markdown).toBeDefined();
    });
  });
});
