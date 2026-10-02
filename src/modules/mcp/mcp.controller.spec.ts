import { Test, TestingModule } from '@nestjs/testing';
import { McpController } from './mcp.controller';
import { McpService } from './services/mcp.service';
import { McpSchemaFormatterService } from './services/mcp-schema-formatter.service';
import { McpServerService } from './services/mcp-server.service';
import type { Request, Response } from 'express';

describe('McpController', () => {
  let controller: McpController;
  let service: McpService;
  let serverService: McpServerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [McpController],
      providers: [McpService, McpSchemaFormatterService, McpServerService],
    }).compile();

    controller = module.get<McpController>(McpController);
    service = module.get<McpService>(McpService);
    serverService = module.get<McpServerService>(McpServerService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
    expect(serverService).toBeDefined();
  });

  describe('handleJsonRpc', () => {
    it('should process synchronous JSON-RPC request without sessionId', async () => {
      const req = { query: {}, headers: {}, body: {} } as unknown as Request;
      let statusCode: number | undefined;
      let jsonBody: Record<string, unknown> | undefined;
      const res = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: Record<string, unknown>) => {
              jsonBody = data;
            },
          };
        },
      } as unknown as Response;

      await controller.handleJsonRpc(req, res, {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      });

      expect(statusCode).toBe(200);
      expect(jsonBody?.jsonrpc).toBe('2.0');
      expect(jsonBody?.id).toBe(1);
      expect(jsonBody?.result).toBeDefined();
    });

    it('should route to mcpServerService when sessionId is present', async () => {
      const postMessageSpy = jest
        .spyOn(serverService, 'handlePostMessage')
        .mockResolvedValueOnce(undefined);
      const req = {
        query: { sessionId: 'test-session-id' },
        headers: {},
        body: {},
      } as unknown as Request;
      const res = {} as Response;

      await controller.handleJsonRpc(req, res, {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      });

      expect(postMessageSpy).toHaveBeenCalledWith(req, res);
    });
  });

  describe('handleSse', () => {
    it('should delegate to mcpServerService.handleSseConnection', async () => {
      const sseSpy = jest
        .spyOn(serverService, 'handleSseConnection')
        .mockResolvedValueOnce(undefined);
      const req = {} as Request;
      const res = {} as Response;

      await controller.handleSse(req, res);
      expect(sseSpy).toHaveBeenCalledWith(req, res);
    });
  });

  describe('handleMessages', () => {
    it('should delegate to mcpServerService.handlePostMessage', async () => {
      const postMessageSpy = jest
        .spyOn(serverService, 'handlePostMessage')
        .mockResolvedValueOnce(undefined);
      const req = {} as Request;
      const res = {} as Response;

      await controller.handleMessages(req, res);
      expect(postMessageSpy).toHaveBeenCalledWith(req, res);
    });
  });

  describe('getStatus', () => {
    it('should return mcp server status info', () => {
      const status = controller.getStatus();
      expect(status).toEqual({
        status: 'ok',
        service: 'shelf-api-mcp',
        version: '1.0.0',
        activeSessions: 0,
        toolsCount: 4,
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

    it('should support execution via "execute" toolName and body.tool', () => {
      const response = controller.executeTool('execute', {
        tool: 'api_help',
        arguments: { topic: 'pagination' },
      });
      expect(response.tool).toBe('api_help');
      expect(response.markdown).toContain('Пагинация в Shelf API');
    });

    it('should support execution with api_ prefix', () => {
      const response = controller.executeTool('api_describe', {
        arguments: { path: '/parts' },
      });
      expect(response.tool).toBe('api_describe');
      expect(response.result.isError).toBeFalsy();
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
