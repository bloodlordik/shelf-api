import {
  Injectable,
  Logger,
  OnModuleDestroy,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { McpService } from './mcp.service';

interface ActiveSession {
  server: McpServer;
  transport: SSEServerTransport;
  createdAt: Date;
}

@Injectable()
export class McpServerService implements OnModuleDestroy {
  private readonly logger = new Logger(McpServerService.name);
  private readonly sessions = new Map<string, ActiveSession>();

  constructor(private readonly mcpService: McpService) {}

  /**
   * Returns current active sessions count.
   */
  get activeSessionsCount(): number {
    return this.sessions.size;
  }

  /**
   * Creates and configures an McpServer instance with registered tools.
   */
  createMcpServerInstance(): McpServer {
    const server = new McpServer({
      name: 'shelf-api-mcp',
      version: '1.0.0',
    });

    server.registerTool(
      'help',
      {
        description:
          'Возвращает подробное руководство по структуре Shelf API, правилам пагинации, акторам, доменным моделям и рекомендуемому сценарию работы автономного агента.',
        inputSchema: z.object({
          topic: z
            .enum([
              'overview',
              'pagination',
              'actors',
              'attributes',
              'parts',
              'stock',
              'categories',
              'units',
              'tags',
              'health',
            ])
            .optional()
            .describe('Опциональная тема справки'),
        }),
      },
      (args) => {
        const result = this.mcpService.executeTool('help', args);
        return {
          content: result.content.map((c) => ({
            type: 'text' as const,
            text: c.text ?? '',
          })),
          isError: result.isError,
        };
      },
    );

    server.registerTool(
      'index',
      {
        description:
          'Возвращает структурированный каталог всех доступных эндпоинтов Shelf API (с группировкой по тегам, кратким описанием и статусом устаревания).',
        inputSchema: z.object({
          tag: z
            .string()
            .optional()
            .describe(
              'Фильтрация по тегу OpenAPI (например: parts, stock, actors, attributes)',
            ),
        }),
      },
      (args) => {
        const result = this.mcpService.executeTool('index', args);
        return {
          content: result.content.map((c) => ({
            type: 'text' as const,
            text: c.text ?? '',
          })),
          isError: result.isError,
        };
      },
    );

    server.registerTool(
      'describe',
      {
        description:
          'Возвращает детальную техническую спецификацию конкретного эндпоинта Shelf API (path/query/body параметры, схемы DTO, примеры JSON, правила валидации и статус-коды).',
        inputSchema: z.object({
          path: z
            .string()
            .optional()
            .describe('Путь эндпоинта (например: /parts, /stock/movements)'),
          method: z
            .string()
            .optional()
            .describe('HTTP метод (GET, POST, PATCH, DELETE)'),
          operationId: z
            .string()
            .optional()
            .describe('Уникальный operationId из схемы Swagger'),
        }),
      },
      (args) => {
        const result = this.mcpService.executeTool('describe', args);
        return {
          content: result.content.map((c) => ({
            type: 'text' as const,
            text: c.text ?? '',
          })),
          isError: result.isError,
        };
      },
    );

    server.registerTool(
      'search',
      {
        description:
          'Интеллектуальный полнотекстовый поиск по API: ищет совпадения в маршрутах, summary, подробных описаниях, тегах и внутренних полях DTO схем.',
        inputSchema: z.object({
          query: z
            .string()
            .describe(
              'Поисковый запрос (например: barcode, movement, attribute, user)',
            ),
          tag: z
            .string()
            .optional()
            .describe('Ограничить поиск конкретным OpenAPI тегом'),
          method: z
            .string()
            .optional()
            .describe(
              'Ограничить поиск конкретным HTTP методом (GET, POST и т.д.)',
            ),
        }),
      },
      (args) => {
        const result = this.mcpService.executeTool('search', args);
        return {
          content: result.content.map((c) => ({
            type: 'text' as const,
            text: c.text ?? '',
          })),
          isError: result.isError,
        };
      },
    );

    return server;
  }

  /**
   * Handles GET /api/v1/mcp/sse connection.
   */
  async handleSseConnection(req: Request, res: Response): Promise<void> {
    const server = this.createMcpServerInstance();
    const transport = new SSEServerTransport('/api/v1/mcp/messages', res);
    const sessionId = transport.sessionId;

    const session: ActiveSession = {
      server,
      transport,
      createdAt: new Date(),
    };

    this.sessions.set(sessionId, session);
    this.logger.log(
      `MCP SSE session initiated: ${sessionId} (active sessions: ${this.sessions.size})`,
    );

    const cleanup = (shouldCloseServer = false) => {
      if (!this.sessions.has(sessionId)) {
        return;
      }
      this.logger.log(`MCP SSE session closed: ${sessionId}`);
      this.sessions.delete(sessionId);
      if (shouldCloseServer) {
        void server.close().catch((err: unknown) => {
          this.logger.warn(
            `Error closing MCP server for session ${sessionId}: ${(err as Error)?.message}`,
          );
        });
      }
    };

    transport.onclose = () => {
      cleanup(false);
    };

    transport.onerror = (err: Error) => {
      this.logger.error(
        `MCP SSE transport error on session ${sessionId}: ${err.message}`,
        err.stack,
      );
    };

    req.on('close', () => {
      cleanup();
    });
    await server.connect(transport);
  }

  /**
   * Handles incoming POST messages for an active SSE session.
   */
  async handlePostMessage(req: Request, res: Response): Promise<void> {
    const rawSessionId =
      (req.query?.sessionId as string) ||
      (req.headers?.['x-session-id'] as string) ||
      (req.body && typeof req.body === 'object' && 'sessionId' in req.body
        ? String((req.body as Record<string, unknown>).sessionId)
        : undefined);

    const sessionId = rawSessionId ? String(rawSessionId).trim() : undefined;

    if (!sessionId) {
      throw new BadRequestException(
        'Отсутствует обязательный параметр sessionId в запросе',
      );
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException(
        `MCP сессия "${sessionId}" не найдена или была закрыта`,
      );
    }

    await session.transport.handlePostMessage(req, res, req.body);
  }

  /**
   * Cleans up all active sessions on module shutdown.
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log(
      `Destroying McpServerService: closing ${this.sessions.size} active sessions`,
    );
    const sessionsToClose = Array.from(this.sessions.entries());
    this.sessions.clear();

    const closePromises = sessionsToClose.map(async ([id, session]) => {
      try {
        await session.server.close();
      } catch (err: unknown) {
        this.logger.warn(
          `Error closing session ${id}: ${(err as Error)?.message}`,
        );
      }
    });

    await Promise.allSettled(closePromises);
  }
}
