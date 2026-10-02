import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { McpService } from './services/mcp.service';
import { McpServerService } from './services/mcp-server.service';
import {
  HelpToolDto,
  IndexToolDto,
  DescribeToolDto,
  SearchToolDto,
  ExecuteToolBodyDto,
  McpJsonRpcBodyDto,
} from './dto/mcp-tools.dto';
import type {
  McpToolDefinition,
  McpToolCallResult,
} from './interfaces/mcp.interfaces';

export interface McpMarkdownResponse {
  markdown: string;
}

export interface McpToolsListResponse {
  tools: McpToolDefinition[];
}

export interface McpExecuteToolResponse {
  tool: string;
  result: McpToolCallResult;
  markdown: string;
}

export interface McpStatusResponse {
  status: string;
  service: string;
  version: string;
  activeSessions: number;
  toolsCount: number;
}

@ApiTags('mcp')
@Controller('mcp')
export class McpController {
  constructor(
    private readonly mcpService: McpService,
    private readonly mcpServerService: McpServerService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'MCP JSON-RPC 2.0 endpoint',
    description:
      'Стандартный JSON-RPC 2.0 интерфейс Model Context Protocol (поддерживает как синхронные запросы, так и маршрутизацию по sessionId в активную SSE сессию).',
  })
  @ApiResponse({
    status: 200,
    description: 'Синхронный JSON-RPC 2.0 ответ',
  })
  @ApiResponse({
    status: 202,
    description: 'Сообщение принято к обработке для SSE сессии',
  })
  async handleJsonRpc(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: McpJsonRpcBodyDto,
  ): Promise<void> {
    const rawSessionId =
      (req.query?.sessionId as string) ||
      (req.headers?.['x-session-id'] as string) ||
      (body && typeof body === 'object' && 'sessionId' in body
        ? String((body as Record<string, unknown>).sessionId)
        : undefined);

    if (rawSessionId) {
      await this.mcpServerService.handlePostMessage(req, res);
      return;
    }

    const response = this.mcpService.handleJsonRpc({
      jsonrpc: body.jsonrpc,
      id: body.id,
      method: body.method,
      params: body.params,
    });
    res.status(HttpStatus.OK).json(response);
  }

  @Get('sse')
  @ApiOperation({
    summary: 'MCP Server-Sent Events (SSE) stream',
    description:
      'Устанавливает Server-Sent Events соединение по протоколу Model Context Protocol (MCP).',
  })
  @ApiResponse({ status: 200, description: 'SSE поток успешно установлен' })
  async handleSse(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.mcpServerService.handleSseConnection(req, res);
  }

  @Post('messages')
  @ApiOperation({
    summary: 'Прием сообщений MCP сессии',
    description:
      'Обрабатывает входящие JSON-RPC запросы для активной SSE сессии.',
  })
  @ApiQuery({
    name: 'sessionId',
    required: true,
    description: 'UUID активной SSE сессии',
  })
  @ApiResponse({
    status: 202,
    description: 'Сообщение принято к асинхронной обработке',
  })
  async handleMessages(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.mcpServerService.handlePostMessage(req, res);
  }

  @Get('status')
  @ApiOperation({
    summary: 'Статус и метрики MCP сервера',
    description:
      'Возвращает текущее состояние MCP сервера, количество активных SSE сессий и зарегистрированных инструментов.',
  })
  @ApiResponse({ status: 200, description: 'Статус сервера' })
  getStatus(): McpStatusResponse {
    return {
      status: 'ok',
      service: 'shelf-api-mcp',
      version: '1.0.0',
      activeSessions: this.mcpServerService.activeSessionsCount,
      toolsCount: 4,
    };
  }

  @Get('tools')
  @ApiOperation({
    summary: 'Список доступных MCP инструментов',
    description:
      'Возвращает метаданные и JSON Schema для всех 4 инструментов (help, index, describe, search).',
  })
  @ApiResponse({
    status: 200,
    description: 'Список определений инструментов',
  })
  getTools(): McpToolsListResponse {
    return {
      tools: this.mcpService.getToolDefinitions(),
    };
  }

  @Post('tools/:toolName')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Выполнение MCP инструмента через REST',
    description:
      'Позволяет вызвать конкретный инструмент передав аргументы в теле запроса.',
  })
  @ApiParam({
    name: 'toolName',
    enum: [
      'help',
      'index',
      'describe',
      'search',
      'api_help',
      'api_index',
      'api_describe',
      'api_search',
      'execute',
    ],
    description:
      'Имя инструмента или "execute" для передачи имени в поле body.tool',
  })
  @ApiResponse({
    status: 200,
    description: 'Результат выполнения инструмента',
  })
  executeTool(
    @Param('toolName') toolName: string,
    @Body() body: ExecuteToolBodyDto,
  ): McpExecuteToolResponse {
    const targetTool =
      toolName === 'execute' && body.tool ? body.tool : toolName;
    const result = this.mcpService.executeTool(
      targetTool,
      body.arguments ?? {},
    );
    const markdown = result.content[0]?.text ?? '';

    return {
      tool: targetTool,
      result,
      markdown,
    };
  }

  @Get('help')
  @ApiOperation({
    summary: 'REST Helper: Справка по Shelf API',
    description:
      'Возвращает подробный Markdown гид по доменам, пагинации, акторам и логике работы.',
  })
  @ApiResponse({
    status: 200,
    description: 'Markdown руководство',
  })
  getHelp(@Query() query: HelpToolDto): McpMarkdownResponse {
    const markdown = this.mcpService.generateHelpMarkdown(query);
    return { markdown };
  }

  @Get('index')
  @ApiOperation({
    summary: 'REST Helper: Каталог всех эндпоинтов',
    description:
      'Возвращает Markdown таблицу всех эндпоинтов API с группировкой по тегам.',
  })
  @ApiResponse({
    status: 200,
    description: 'Markdown каталог эндпоинтов',
  })
  getIndex(@Query() query: IndexToolDto): McpMarkdownResponse {
    const markdown = this.mcpService.generateIndexMarkdown(query);
    return { markdown };
  }

  @Get('describe')
  @ApiOperation({
    summary: 'REST Helper: Детальная спецификация эндпоинта',
    description:
      'Возвращает Markdown описание параметров, TypeScript интерфейс, JSON payload и примеры вызова.',
  })
  @ApiResponse({
    status: 200,
    description: 'Markdown спецификация эндпоинта',
  })
  getDescribe(@Query() query: DescribeToolDto): McpMarkdownResponse {
    const markdown = this.mcpService.generateDescribeMarkdown(query);
    return { markdown };
  }

  @Get('search')
  @ApiOperation({
    summary: 'REST Helper: Полнотекстовый поиск по API',
    description:
      'Ищет эндпоинты по ключевым словам в пути, summary, описаниях и полях DTO схем.',
  })
  @ApiResponse({
    status: 200,
    description: 'Markdown результаты поиска',
  })
  getSearch(@Query() query: SearchToolDto): McpMarkdownResponse {
    const markdown = this.mcpService.generateSearchMarkdown(query);
    return { markdown };
  }
}
