import { Injectable, Logger } from '@nestjs/common';
import type {
  OpenAPIObject,
  OperationObject,
  RequestBodyObject,
  ResponseObject,
} from '@nestjs/swagger';
import {
  McpRequest,
  McpResponse,
  McpToolDefinition,
  McpToolCallResult,
  McpInitializeResult,
  MCP_ERROR_CODES,
} from '../interfaces/mcp.interfaces';
import { McpSchemaFormatterService } from './mcp-schema-formatter.service';
import {
  HelpToolDto,
  IndexToolDto,
  DescribeToolDto,
  SearchToolDto,
} from '../dto/mcp-tools.dto';

interface NormalizedEndpoint {
  method: string;
  path: string;
  originalPath: string;
  operation: OperationObject;
  tags: string[];
  summary: string;
  description: string;
  operationId: string;
  deprecated: boolean;
}

interface SearchMatch {
  endpoint: NormalizedEndpoint;
  score: number;
  matchReasons: string[];
}

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);
  private openApiDocument?: OpenAPIObject;

  constructor(private readonly schemaFormatter: McpSchemaFormatterService) {}

  /**
   * Injects or updates the OpenAPI document instance.
   */
  setOpenApiDocument(document: OpenAPIObject): void {
    this.openApiDocument = document;
    this.logger.log('OpenAPI document successfully registered in McpService');
  }

  /**
   * Retrieves the current OpenAPI document.
   */
  getOpenApiDocument(): OpenAPIObject | undefined {
    return this.openApiDocument;
  }

  /**
   * Returns standard MCP tool definitions.
   */
  getToolDefinitions(): McpToolDefinition[] {
    return [
      {
        name: 'help',
        description:
          'Возвращает подробное руководство по структуре Shelf API, правилам пагинации, акторам, доменным моделям и рекомендуемому сценарию работы автономного агента.',
        inputSchema: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description:
                'Тема справки: "overview", "pagination", "actors", "attributes", "parts", "stock", "categories", "units", "tags", "health".',
            },
          },
        },
      },
      {
        name: 'index',
        description:
          'Возвращает краткую карту (каталог) всех доступных эндпоинтов API с группировкой по доменным тегам. Используйте для общей ориентации по API.',
        inputSchema: {
          type: 'object',
          properties: {
            tag: {
              type: 'string',
              description:
                'Фильтр по Swagger-тегу: "parts", "stock", "attributes", "categories", "units", "tags", "health".',
            },
          },
        },
      },
      {
        name: 'describe',
        description:
          'Предоставляет исчерпывающую техническую спецификацию конкретного эндпоинта: параметры, TypeScript-структуру тела запроса и ответов, примеры JSON, curl и fetch сниппеты.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description:
                'URL путь эндпоинта (например: "/parts", "/api/v1/stock/movements", "/categories/{id}/tree").',
            },
            method: {
              type: 'string',
              description: 'HTTP метод (GET, POST, PUT, PATCH, DELETE).',
            },
            operationId: {
              type: 'string',
              description:
                'Operation ID метода из OpenAPI спецификации (например: "PartsController_create").',
            },
          },
        },
      },
      {
        name: 'search',
        description:
          'Выполняет умный полнотекстовый поиск по путям, описаниям, параметрам и полям DTO/схем. Возвращает релевантные эндпоинты с объяснением совпадений.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'Поисковая фраза (например: "movement", "actorId", "unit", "tree", "quantity", "EAV").',
            },
            tag: {
              type: 'string',
              description: 'Опциональный фильтр по Swagger-тегу.',
            },
            method: {
              type: 'string',
              description: 'Опциональный фильтр по HTTP методу.',
            },
          },
          required: ['query'],
        },
      },
    ];
  }

  /**
   * Dispatches and executes an MCP tool by name with arguments.
   */
  executeTool(
    name: string,
    args: Record<string, unknown> = {},
  ): McpToolCallResult {
    try {
      let markdown = '';
      const normalizedName = (
        name.startsWith('api_')
          ? name.slice(4)
          : name.startsWith('API_')
            ? name.slice(4)
            : name
      ).toLowerCase();

      switch (normalizedName) {
        case 'help': {
          const dto: HelpToolDto = {
            topic: typeof args.topic === 'string' ? args.topic : undefined,
          };
          markdown = this.generateHelpMarkdown(dto);
          break;
        }
        case 'index': {
          const dto: IndexToolDto = {
            tag: typeof args.tag === 'string' ? args.tag : undefined,
          };
          markdown = this.generateIndexMarkdown(dto);
          break;
        }
        case 'describe': {
          const dto: DescribeToolDto = {
            path: typeof args.path === 'string' ? args.path : undefined,
            method: typeof args.method === 'string' ? args.method : undefined,
            operationId:
              typeof args.operationId === 'string'
                ? args.operationId
                : undefined,
          };
          markdown = this.generateDescribeMarkdown(dto);
          break;
        }
        case 'search': {
          const query = typeof args.query === 'string' ? args.query : '';
          const dto: SearchToolDto = {
            query,
            tag: typeof args.tag === 'string' ? args.tag : undefined,
            method: typeof args.method === 'string' ? args.method : undefined,
          };
          markdown = this.generateSearchMarkdown(dto);
          break;
        }
        default:
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Неизвестный инструмент: "${name}". Доступные инструменты: help, index, describe, search.`,
              },
            ],
          };
      }

      return {
        content: [
          {
            type: 'text',
            text: markdown,
          },
        ],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error executing tool "${name}": ${message}`);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Ошибка при выполнении инструмента "${name}": ${message}`,
          },
        ],
      };
    }
  }

  /**
   * Processes a standard JSON-RPC 2.0 MCP request.
   */
  handleJsonRpc(request: McpRequest): McpResponse {
    const id = request.id ?? null;

    if (!request || request.jsonrpc !== '2.0' || !request.method) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: MCP_ERROR_CODES.INVALID_REQUEST,
          message: 'Invalid JSON-RPC 2.0 request payload',
        },
      };
    }

    try {
      switch (request.method) {
        case 'initialize': {
          const result: McpInitializeResult = {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'shelf-api-mcp',
              version: '1.0.0',
            },
            instructions:
              'Встроенный MCP модуль Shelf API для автономных агентов. Используйте tools: help, index, describe, search для исследования и вызова складских API.',
          };
          return { jsonrpc: '2.0', id, result };
        }

        case 'notifications/initialized': {
          return { jsonrpc: '2.0', id, result: {} };
        }

        case 'ping': {
          return { jsonrpc: '2.0', id, result: {} };
        }

        case 'tools/list': {
          const tools = this.getToolDefinitions();
          return { jsonrpc: '2.0', id, result: { tools } };
        }

        case 'tools/call': {
          const params = request.params as Record<string, unknown> | undefined;
          const toolName = typeof params?.name === 'string' ? params.name : '';
          const toolArgs =
            params?.arguments &&
            typeof params.arguments === 'object' &&
            !Array.isArray(params.arguments)
              ? (params.arguments as Record<string, unknown>)
              : params && typeof params === 'object'
                ? (Object.fromEntries(
                    Object.entries(params).filter(([k]) => k !== 'name'),
                  ) as Record<string, unknown>)
                : {};

          if (!toolName) {
            return {
              jsonrpc: '2.0',
              id,
              error: {
                code: MCP_ERROR_CODES.INVALID_PARAMS,
                message: 'Missing "name" parameter in tools/call request',
              },
            };
          }

          const callResult = this.executeTool(toolName, toolArgs);
          return { jsonrpc: '2.0', id, result: callResult };
        }

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: MCP_ERROR_CODES.METHOD_NOT_FOUND,
              message: `Method not found: ${request.method}`,
            },
          };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: MCP_ERROR_CODES.INTERNAL_ERROR,
          message: `Internal server error: ${message}`,
        },
      };
    }
  }

  // ==========================================
  // Tool 1: HELP
  // ==========================================

  generateHelpMarkdown(dto: HelpToolDto = {}): string {
    const topic = dto.topic?.toLowerCase().trim();

    if (topic === 'pagination') {
      return [
        '# Пагинация в Shelf API',
        '',
        'Все списочные эндпоинты поддерживают стандартную пагинацию через query-параметры:',
        '- `page` (number, default: 1) — номер страницы (начиная с 1).',
        '- `limit` (number, default: 10, max: 100) — количество элементов на страницу.',
        '',
        '### Формат ответа (`PaginatedResponseDto<T>`):',
        '```json',
        '{',
        '  "data": [ ... ],',
        '  "meta": {',
        '    "page": 1,',
        '    "limit": 10,',
        '    "itemCount": 42,',
        '    "pageCount": 5,',
        '    "hasPreviousPage": false,',
        '    "hasNextPage": true',
        '  }',
        '}',
        '```',
      ].join('\n');
    }

    if (topic === 'actors') {
      return [
        '# Учет акторов (Actors) в Shelf API',
        '',
        'Все изменяющие складские операции и аудит-журналы фиксируют автора действия (актора).',
        '- Акторы идентифицируются целочисленным идентификатором `actorId: number` (int).',
        '- Актор автоматически создается/обновляется при первом упоминании (метод `ensureActor`).',
        '- При вызове API создания складского движения (`POST /api/v1/stock/movements`) передается обязательное поле `actorId`.',
        '- В истории изменений атрибутов (`/api/v1/attributes/history`) доступна фильтрация по `actorId`.',
      ].join('\n');
    }

    if (topic === 'attributes') {
      return [
        '# Динамические атрибуты (EAV) и аудит-лог',
        '',
        'Система поддерживает гибкую динамическую схему атрибутов компонентов:',
        '- **Типы атрибутов (`AttributeType`)**:',
        '  - `STRING` — произвольная текстовая строка.',
        '  - `NUMBER` — числовое значение (с поддержкой единиц измерения `unitId`).',
        '  - `BOOLEAN` — логическое значение (`true`/`false`).',
        '  - `SELECT` — выбор одного значения из предопределенного справочника (`AttributeOption`).',
        '  - `MULTI_SELECT` — выбор нескольких значений из справочника.',
        '- **Аудит изменений (`attribute_value_history`)**:',
        '  - Любое изменение значения атрибута детали автоматически логируется с сохранением `old_value`, `new_value`, `actor_id`, `change_reason`, `created_at`.',
        '  - Эндпоинт истории: `GET /api/v1/attributes/history`.',
      ].join('\n');
    }

    if (topic === 'stock') {
      return [
        '# Складской учет и движения (`Stock Movements`)',
        '',
        'Складской учет реализован по модели неизменяемого журнала движений (Immutable Ledger):',
        '- **Типы движений (`StockMovementType`)**:',
        '  - `IN` — приход (поступление на склад, увеличивает остаток).',
        '  - `OUT` — расход (списание/выдача, уменьшает остаток).',
        '  - `ADJUSTMENT` — корректировка/инвентаризация (может увеличивать или уменьшать остаток).',
        '  - `INITIAL` — начальный ввод остатков.',
        '  - `TRANSFER` — перемещение между местами хранения.',
        '- **Свойства движения**:',
        '  - `partId: string` (UUID) — деталь.',
        '  - `type: StockMovementType` — тип операции.',
        '  - `quantity: number` — количество.',
        '  - `actorId: number` — идентификатор ответственного лица.',
        '  - `comment?: string` — примечание/обоснование.',
        '  - `batchNumber?: string` — номер партии.',
        '  - `location?: string` — склад/ячейка хранения.',
      ].join('\n');
    }

    // Default general help guide
    return [
      '# Руководство по Shelf API (Electronic Warehouse Assistant)',
      '',
      '**Shelf API** — сервис учета электронных компонентов, категорий, EAV-атрибутов и складских движений.',
      '',
      '## Основные параметры среды',
      '- **Base URL**: `/api/v1` (глобальный префикс `api`, версия `v1`).',
      '- **Формат обмена**: `application/json`.',
      '- **Формат ошибок**: `{ "statusCode": 400, "message": "...", "error": "Bad Request" }`.',
      '',
      '## Ключевые доменные области',
      '1. **Units (`/api/v1/units`)**: Единицы измерения (шт, м, кг, Ом, Ф, В и др.).',
      '2. **Categories (`/api/v1/categories`)**: Иерархическое дерево категорий с поддержкой вложенности (`/tree`).',
      '3. **Tags (`/api/v1/tags`)**: Метки компонентов для быстрой классификации и фильтрации.',
      '4. **Attributes (`/api/v1/attributes`)**: EAV схема динамических атрибутов деталей и аудит изменений (`/history`).',
      '5. **Parts (`/api/v1/parts`)**: Каталог компонентов, карточки с агрегированными атрибутами, остатками и тегами.',
      '6. **Stock Movements (`/api/v1/stock`)**: Проводки прихода, расхода, корректировки и перемещений с учетом акторов.',
      '7. **Health (`/api/v1/health`)**: Мониторинг liveness/readiness и диагностика базы данных.',
      '',
      '## Рекомендуемый алгоритм работы автономного агента',
      '1. **Обзор API**: Вызовите `index()` для получения списка всех доступных эндпоинтов.',
      '2. **Поиск нужного действия**: Вызовите `search(query: "...")` для нахождения конкретной операции или поля.',
      '3. **Получение схемы и типов**: Вызовите `describe(path: "...", method: "...")` для получения точной структуры DTO, TypeScript интерфейсов и готовых JSON примеров.',
      '4. **Вызов эндпоинта**: Сформируйте корректный запрос на основе полученной схемы.',
      '',
      'Для углубленной справки используйте `help(topic: "pagination" | "actors" | "attributes" | "stock")`.',
    ].join('\n');
  }

  // ==========================================
  // Tool 2: INDEX
  // ==========================================

  generateIndexMarkdown(dto: IndexToolDto = {}): string {
    const endpoints = this.getNormalizedEndpoints();

    if (endpoints.length === 0) {
      return '_OpenAPI спецификация пуста или еще не зарегистрирована._';
    }

    const tagFilter = dto.tag?.toLowerCase().trim();
    const filtered = tagFilter
      ? endpoints.filter((e) =>
          e.tags.some((t) => t.toLowerCase() === tagFilter),
        )
      : endpoints;

    if (filtered.length === 0) {
      const availableTags = Array.from(
        new Set(endpoints.flatMap((e) => e.tags)),
      ).join(', ');
      return `По тегу "${dto.tag}" эндпоинтов не найдено. Доступные теги: ${availableTags}`;
    }

    // Group by tag
    const grouped: Record<string, NormalizedEndpoint[]> = {};
    for (const ep of filtered) {
      const primaryTag = ep.tags[0] || 'General';
      if (!grouped[primaryTag]) {
        grouped[primaryTag] = [];
      }
      grouped[primaryTag].push(ep);
    }

    const lines: string[] = [
      '# Каталог эндпоинтов Shelf API',
      '',
      `Всего эндпоинтов: ${filtered.length}${tagFilter ? ` (фильтр по тегу "${dto.tag}")` : ''}.`,
      '',
    ];

    for (const [tag, groupEndpoints] of Object.entries(grouped)) {
      lines.push(`## Домен: ${tag}`);
      lines.push('');
      lines.push('| Метод | Путь | Описание (Summary) | Operation ID |');
      lines.push('| :--- | :--- | :--- | :--- |');

      for (const ep of groupEndpoints) {
        const methodBadge = `\`${ep.method}\``;
        const pathCode = `\`${ep.path}\``;
        const summary = (ep.summary || ep.description || '-').replace(
          /\|/g,
          '\\|',
        );
        const opId = ep.operationId ? `\`${ep.operationId}\`` : '-';
        lines.push(`| ${methodBadge} | ${pathCode} | ${summary} | ${opId} |`);
      }
      lines.push('');
    }

    lines.push(
      '_Для детальной схемы вызовите: `describe(path: "/...", method: "GET|POST|...")`._',
    );

    return lines.join('\n');
  }

  // ==========================================
  // Tool 3: DESCRIBE
  // ==========================================

  generateDescribeMarkdown(dto: DescribeToolDto = {}): string {
    const endpoints = this.getNormalizedEndpoints();

    if (endpoints.length === 0) {
      return '_OpenAPI спецификация пуста или еще не зарегистрирована._';
    }

    let match: NormalizedEndpoint | undefined;

    // 1. Try matching by operationId
    if (dto.operationId) {
      match = endpoints.find(
        (e) => e.operationId.toLowerCase() === dto.operationId?.toLowerCase(),
      );
    }

    // 2. Try matching by path + method
    if (!match && dto.path) {
      const cleanInputPath = this.normalizePathString(dto.path);
      const inputMethod = dto.method?.toUpperCase().trim();

      const samePathCandidates = endpoints.filter((e) => {
        const normEpPath = this.normalizePathString(e.path);
        return normEpPath === cleanInputPath;
      });

      if (samePathCandidates.length > 0) {
        if (inputMethod) {
          match = samePathCandidates.find((e) => e.method === inputMethod);
        } else if (samePathCandidates.length === 1) {
          match = samePathCandidates[0];
        } else {
          const methodsList = samePathCandidates
            .map((c) => c.method)
            .join(', ');
          return [
            `# Путь \`${dto.path}\` поддерживает несколько методов: ${methodsList}.`,
            '',
            'Пожалуйста, укажите параметр `method` при вызове `describe`, например:',
            ...samePathCandidates.map(
              (c) =>
                `- \`describe(path: "${dto.path}", method: "${c.method}")\``,
            ),
          ].join('\n');
        }
      }
    }

    // If still not matched, find fuzzy candidates
    if (!match) {
      const candidates = dto.path
        ? endpoints.filter((e) => {
            const searchPart =
              dto.path?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
            const epPart = e.path.toLowerCase().replace(/[^a-z0-9]/g, '');
            return epPart.includes(searchPart) || searchPart.includes(epPart);
          })
        : [];

      if (candidates.length > 0) {
        return [
          `# Эндпоинт не найден: \`${dto.method || ''} ${dto.path || dto.operationId || ''}\``,
          '',
          'Возможно, вы имели в виду один из следующих маршрутов:',
          ...candidates
            .slice(0, 8)
            .map(
              (c) =>
                `- \`${c.method} ${c.path}\` (Operation: \`${c.operationId}\`) — ${c.summary || c.description || '-'}`,
            ),
        ].join('\n');
      }

      return `Эндпоинт \`${dto.method || ''} ${dto.path || dto.operationId || ''}\` не найден в спецификации. Вызовите \`index()\` или \`search(query: "...")\` для поиска.`;
    }

    // Generate comprehensive Markdown specification for the matched endpoint
    const op = match.operation;
    const lines: string[] = [
      `# ${match.method} ${match.path}`,
      '',
      `**Summary**: ${match.summary || '-'}  `,
      `**Operation ID**: \`${match.operationId || '-'}\`  `,
      `**Tags**: ${match.tags.map((t) => `\`${t}\``).join(', ') || '-'}  `,
      `**Deprecated**: ${match.deprecated ? '⚠️ **ДА**' : 'Нет'}`,
      '',
    ];

    if (match.description && match.description !== match.summary) {
      lines.push('### Описание');
      lines.push(match.description);
      lines.push('');
    }

    // Parameters
    lines.push('### Параметры запроса (Query, Path, Header)');
    lines.push(
      this.schemaFormatter.formatParametersTable(
        op.parameters,
        this.openApiDocument,
      ),
    );

    // Request Body
    if (op.requestBody) {
      lines.push('### Тело запроса (Request Body)');
      const formattedBody = this.schemaFormatter.formatRequestBody(
        op.requestBody,
        this.openApiDocument,
      );

      if (formattedBody) {
        lines.push(`- **Content-Type**: \`${formattedBody.contentType}\``);
        lines.push(
          `- **Обязательное**: ${formattedBody.required ? '**Да**' : 'Нет'}`,
        );
        lines.push('');
        lines.push('#### TypeScript интерфейс');
        lines.push('```typescript');
        lines.push(formattedBody.typeScriptDefinition);
        lines.push('```');
        lines.push('');
        lines.push('#### Пример JSON payload');
        lines.push('```json');
        lines.push(formattedBody.exampleJson);
        lines.push('```');
        lines.push('');
      }
    }

    // Responses
    lines.push('### Ответы (Responses)');
    const responses = this.schemaFormatter.formatResponses(
      op.responses,
      this.openApiDocument,
    );

    for (const resp of responses) {
      lines.push(
        `#### HTTP ${resp.statusCode} — ${resp.description || 'Успешный ответ'}`,
      );
      if (resp.typeScriptDefinition) {
        lines.push('**TypeScript Тип:**');
        lines.push('```typescript');
        lines.push(resp.typeScriptDefinition);
        lines.push('```');
      }
      if (resp.exampleJson) {
        lines.push('**Пример ответа JSON:**');
        lines.push('```json');
        lines.push(resp.exampleJson);
        lines.push('```');
      }
      lines.push('');
    }

    // Code snippets
    lines.push('### Примеры вызова');
    lines.push('#### cURL:');
    lines.push('```bash');
    if (match.method === 'GET' || match.method === 'DELETE') {
      lines.push(
        `curl -X ${match.method} "http://localhost:3000${match.path}" \\`,
      );
      lines.push('  -H "Accept: application/json"');
    } else {
      lines.push(
        `curl -X ${match.method} "http://localhost:3000${match.path}" \\`,
      );
      lines.push('  -H "Content-Type: application/json" \\');
      lines.push("  -d '{'");
    }
    lines.push('```');
    lines.push('');

    // Domain Specific Advice
    if (match.path.includes('/parts')) {
      lines.push('### 💡 Доменная подсказка (Parts / EAV)');
      lines.push(
        '- Поле `attributes` в карточке детали представляет собой словарь динамических атрибутов, соответствующих зарегистрированным определениям `AttributeDefinition`.',
      );
      lines.push(
        '- Для обновления набора атрибутов детали используйте `PUT /api/v1/parts/:id/attributes`.',
      );
    } else if (match.path.includes('/stock')) {
      lines.push('### 💡 Доменная подсказка (Stock Movements)');
      lines.push(
        '- Каждая операция движения (`StockMovement`) требует указания `actorId` (числовой ID оператора).',
      );
      lines.push(
        '- Допустимые типы: `IN` (приход), `OUT` (расход), `ADJUSTMENT` (корректировка), `INITIAL` (ввод остатков), `TRANSFER` (перемещение).',
      );
    } else if (match.path.includes('/categories')) {
      lines.push('### 💡 Доменная подсказка (Categories)');
      lines.push(
        '- Для получения полного вложенного дерева категорий используйте `GET /api/v1/categories/tree`.',
      );
    }

    return lines.join('\n');
  }

  // ==========================================
  // Tool 4: SEARCH
  // ==========================================

  generateSearchMarkdown(dto: SearchToolDto): string {
    const endpoints = this.getNormalizedEndpoints();

    if (endpoints.length === 0) {
      return '_OpenAPI спецификация пуста или еще не зарегистрирована._';
    }

    const query = dto.query.toLowerCase().trim();
    if (!query) {
      return 'Поисковый запрос пуст. Укажите ключевое слово (например: `search(query: "part")`).';
    }

    const tagFilter = dto.tag?.toLowerCase().trim();
    const methodFilter = dto.method?.toUpperCase().trim();

    const matches: SearchMatch[] = [];

    for (const ep of endpoints) {
      if (tagFilter && !ep.tags.some((t) => t.toLowerCase() === tagFilter)) {
        continue;
      }
      if (methodFilter && ep.method !== methodFilter) {
        continue;
      }

      let score = 0;
      const matchReasons: string[] = [];

      // 1. Path match
      if (ep.path.toLowerCase().includes(query)) {
        score += 100;
        matchReasons.push(`Совпадение в пути URL: \`${ep.path}\``);
      }

      // 2. Summary match
      if (ep.summary.toLowerCase().includes(query)) {
        score += 80;
        matchReasons.push(`Совпадение в summary: "${ep.summary}"`);
      }

      // 3. Description match
      if (ep.description.toLowerCase().includes(query)) {
        score += 50;
        matchReasons.push('Совпадение в подробном описании');
      }

      // 4. Operation ID match
      if (ep.operationId.toLowerCase().includes(query)) {
        score += 70;
        matchReasons.push(`Совпадение в Operation ID: \`${ep.operationId}\``);
      }

      // 5. Tags match
      if (ep.tags.some((t) => t.toLowerCase().includes(query))) {
        score += 40;
        matchReasons.push(`Совпадение в теге: ${ep.tags.join(', ')}`);
      }

      // 6. Parameter names & descriptions
      if (ep.operation.parameters) {
        for (const p of ep.operation.parameters) {
          if (!this.schemaFormatter.isReferenceObject(p)) {
            if (p.name.toLowerCase().includes(query)) {
              score += 60;
              matchReasons.push(`Совпадение в имени параметра: \`${p.name}\``);
            } else if (p.description?.toLowerCase().includes(query)) {
              score += 30;
              matchReasons.push(
                `Совпадение в описании параметра: \`${p.name}\``,
              );
            }
          }
        }
      }

      // 7. Request body schema tokens
      if (ep.operation.requestBody) {
        let reqBody: RequestBodyObject | undefined;
        if (this.schemaFormatter.isReferenceObject(ep.operation.requestBody)) {
          const resolved = this.schemaFormatter.resolveRef(
            ep.operation.requestBody.$ref,
            this.openApiDocument,
          );
          if (resolved) {
            reqBody = resolved as unknown as RequestBodyObject;
          }
        } else {
          reqBody = ep.operation.requestBody;
        }

        if (reqBody && reqBody.content) {
          for (const mediaType of Object.values(reqBody.content)) {
            if (mediaType && mediaType.schema) {
              const bodyTokens = this.schemaFormatter.extractSchemaSearchText(
                mediaType.schema,
                this.openApiDocument,
              );
              const matchingToken = bodyTokens.find((t) =>
                t.toLowerCase().includes(query),
              );
              if (matchingToken) {
                score += 40;
                matchReasons.push(
                  `Совпадение в схеме тела запроса: \`${matchingToken}\``,
                );
                break;
              }
            }
          }
        }
      }

      // 8. Response schema tokens
      if (ep.operation.responses) {
        for (const respOrRef of Object.values(ep.operation.responses)) {
          if (!respOrRef) continue;
          let respObj: ResponseObject | undefined;
          if (this.schemaFormatter.isReferenceObject(respOrRef)) {
            const resolved = this.schemaFormatter.resolveRef(
              respOrRef.$ref,
              this.openApiDocument,
            );
            if (resolved) {
              respObj = resolved as unknown as ResponseObject;
            }
          } else {
            respObj = respOrRef;
          }

          if (respObj && respObj.content) {
            for (const mediaType of Object.values(respObj.content)) {
              if (mediaType && mediaType.schema) {
                const respTokens = this.schemaFormatter.extractSchemaSearchText(
                  mediaType.schema,
                  this.openApiDocument,
                );
                const matchingToken = respTokens.find((t) =>
                  t.toLowerCase().includes(query),
                );
                if (matchingToken) {
                  score += 30;
                  matchReasons.push(
                    `Совпадение в схеме ответа: \`${matchingToken}\``,
                  );
                  break;
                }
              }
            }
          }
        }
      }

      if (score > 0) {
        matches.push({ endpoint: ep, score, matchReasons });
      }
    }

    if (matches.length === 0) {
      return `По запросу "${dto.query}" ничего не найдено. Попробуйте изменить формулировку или использовать \`index()\` для просмотра всех эндпоинтов.`;
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    const lines: string[] = [
      `# Результаты поиска по запросу "${dto.query}"`,
      '',
      `Найдено совпадений: ${matches.length}.`,
      '',
      '| Метод | Путь | Описание (Summary) | Причина совпадения |',
      '| :--- | :--- | :--- | :--- |',
    ];

    for (const match of matches) {
      const ep = match.endpoint;
      const methodBadge = `\`${ep.method}\``;
      const pathCode = `\`${ep.path}\``;
      const summary = (ep.summary || ep.description || '-').replace(
        /\|/g,
        '\\|',
      );
      const reasons = match.matchReasons
        .slice(0, 2)
        .join('; ')
        .replace(/\|/g, '\\|');
      lines.push(`| ${methodBadge} | ${pathCode} | ${summary} | ${reasons} |`);
    }

    lines.push('');
    lines.push('### Следующий шаг:');
    lines.push(
      `Вызовите \`describe(path: "${matches[0].endpoint.path}", method: "${matches[0].endpoint.method}")\` для изучения выбранного эндпоинта.`,
    );

    return lines.join('\n');
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  private getNormalizedEndpoints(): NormalizedEndpoint[] {
    if (!this.openApiDocument || !this.openApiDocument.paths) {
      return [];
    }

    const endpoints: NormalizedEndpoint[] = [];
    const httpMethods = [
      'get',
      'post',
      'put',
      'patch',
      'delete',
      'options',
      'head',
    ] as const;

    for (const [rawPath, pathItem] of Object.entries(
      this.openApiDocument.paths,
    )) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      const item = pathItem;

      for (const methodKey of httpMethods) {
        const op = item[methodKey];
        if (!op || typeof op !== 'object') continue;

        const operation = op;
        const normalizedPath = rawPath.startsWith('/')
          ? rawPath
          : `/${rawPath}`;

        endpoints.push({
          method: methodKey.toUpperCase(),
          path: normalizedPath,
          originalPath: rawPath,
          operation,
          tags: operation.tags ?? ['General'],
          summary: operation.summary ?? '',
          description: operation.description ?? '',
          operationId: operation.operationId ?? '',
          deprecated: Boolean(operation.deprecated),
        });
      }
    }

    return endpoints;
  }

  private normalizePathString(pathStr: string): string {
    let p = pathStr.trim();
    // remove protocol/host if passed
    p = p.replace(/^https?:\/\/[^/]+/, '');
    // remove /api/v1 prefix if passed
    p = p.replace(/^\/api\/v\d+/, '');
    p = p.replace(/^api\/v\d+/, '');
    // normalize leading slash
    if (!p.startsWith('/')) {
      p = `/${p}`;
    }
    // normalize :param to {param}
    p = p.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
    return p;
  }
}
