import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { McpServerService } from './mcp-server.service';
import { McpService } from './mcp.service';
import { McpSchemaFormatterService } from './mcp-schema-formatter.service';

describe('McpServerService', () => {
  let service: McpServerService;
  let mcpService: McpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [McpServerService, McpService, McpSchemaFormatterService],
    }).compile();

    service = module.get<McpServerService>(McpServerService);
    mcpService = module.get<McpService>(McpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(mcpService).toBeDefined();
  });

  describe('createMcpServerInstance', () => {
    it('should create an McpServer instance with registered tools', () => {
      const serverInstance = service.createMcpServerInstance();
      expect(serverInstance).toBeDefined();
      expect(serverInstance.server).toBeDefined();
    });
  });

  describe('activeSessionsCount', () => {
    it('should initially return 0 active sessions', () => {
      expect(service.activeSessionsCount).toBe(0);
    });
  });

  describe('handlePostMessage', () => {
    it('should throw BadRequestException if sessionId is missing', async () => {
      const req = {
        query: {},
        headers: {},
        body: {},
      } as unknown as Request;
      const res = {} as Response;

      await expect(service.handlePostMessage(req, res)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if session is not found', async () => {
      const req = {
        query: { sessionId: 'non-existent-uuid' },
        headers: {},
        body: {},
      } as unknown as Request;
      const res = {} as Response;

      await expect(service.handlePostMessage(req, res)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('should close all active sessions without throwing errors', async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
      expect(service.activeSessionsCount).toBe(0);
    });
  });
});
