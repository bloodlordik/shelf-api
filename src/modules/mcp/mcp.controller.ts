import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

import { McpService } from './services/mcp.service';
import {
  HelpToolDto,
  IndexToolDto,
  DescribeToolDto,
  SearchToolDto,
  ExecuteToolBodyDto,
  McpJsonRpcBodyDto,
} from './dto/mcp-tools.dto';
import type {
  McpResponse,
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

@ApiTags('mcp')
@Controller('mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'MCP JSON-RPC 2.0 endpoint',
    description:
      'Стандартный JSON-RPC 2.0 интерфейс Model Context Protocol (методы: initialize, tools/list, tools/call, ping).',
  })
  @ApiResponse({
    status: 200,
    description: 'JSON-RPC 2.0 ответ',
  })
  handleJsonRpc(@Body() body: McpJsonRpcBodyDto): McpResponse {
    return this.mcpService.handleJsonRpc({
      jsonrpc: body.jsonrpc,
      id: body.id,
      method: body.method,
      params: body.params,
    });
  }

  @Sse('sse')
  @ApiOperation({
    summary: 'MCP Server-Sent Events (SSE) stream',
    description:
      'SSE поток для подключения MCP клиентов (Claude Desktop, IDE, автономные агенты).',
  })
  handleSse(): Observable<MessageEvent> {
    return from([
      { type: 'endpoint', data: '/api/v1/mcp' },
      { type: 'ping', data: {} },
    ]);
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
    enum: ['help', 'index', 'describe', 'search'],
    description: 'Имя инструмента',
  })
  @ApiResponse({
    status: 200,
    description: 'Результат выполнения инструмента',
  })
  executeTool(
    @Param('toolName') toolName: string,
    @Body() body: ExecuteToolBodyDto,
  ): McpExecuteToolResponse {
    const result = this.mcpService.executeTool(toolName, body.arguments ?? {});
    const markdown = result.content[0]?.text ?? '';

    return {
      tool: toolName,
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
