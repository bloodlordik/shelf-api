# Model Context Protocol (MCP) Module Specification

Модуль `mcp` реализует интеграцию с Model Context Protocol (MCP) и предоставляет специализированный API для AI-агентов и LLM, позволяя им исследовать спецификацию OpenAPI, понимать схемы данных, генерировать TypeScript-типы и безопасно вызывать эндпоинты.

## 1. Архитектура и инициализация

- **Контроллер:** `McpController` (`src/modules/mcp/mcp.controller.ts`)
- **Сервисы:**
  - `McpServerService` (`src/modules/mcp/services/mcp-server.service.ts`) — высокоуровневый сервер MCP на базе официального SDK `@modelcontextprotocol/sdk` и `zod`, управление сессиями `SSEServerTransport` и маршрутизацией асинхронных сообщений.
  - `McpService` (`src/modules/mcp/services/mcp.service.ts`) — генерация Markdown-ответов, семантический поиск по OpenAPI и синхронная обработка JSON-RPC 2.0.
  - `McpSchemaFormatterService` (`src/modules/mcp/services/mcp-schema-formatter.service.ts`) — рекурсивное преобразование OpenAPI 3.0 схем в TypeScript интерфейсы и примеры данных.
- **Инициализация документа:** В `main.ts` сгенерированный Swagger/OpenAPI документ регистрируется в сервисе:
  ```typescript
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  mcpService.setOpenApiDocument(document);
  ```

---

## 2. Доступные MCP Инструменты (Tools)

Инструменты поддерживают вызов как по каноническим именам (`help`, `index`, `describe`, `search`), так и по именам с префиксом (`api_help`, `api_index`, `api_describe`, `api_search`).

### 1. `help` / `api_help`
Возвращает руководство для AI-агента по эффективной навигации и работе с API.
- **Параметры:** `HelpToolDto` (`topic?: 'overview' | 'pagination' | 'actors' | 'attributes' | 'parts' | 'stock' | 'categories' | 'units' | 'tags' | 'health'`).
- **Результат:** Форматированный Markdown с инструкциями и примерами сценариев.

### 2. `index` / `api_index`
Предоставляет каталог всех эндпоинтов API с группировкой по тегам/модулям.
- **Параметры:** `IndexToolDto` (`tag?: string`).
- **Результат:** Таблица доступных маршрутов, HTTP-методов и кратких описаний.

### 3. `describe` / `api_describe`
Выполняет глубокую интроспекцию конкретного эндпоинта.
- **Параметры:** `DescribeToolDto` (`path?: string`, `method?: string`, `operationId?: string`).
- **Результат:** Полное описание эндпоинта:
  - Query и Path параметры с типами и признаком обязательности.
  - TypeScript-определение структуры Request Body с примером JSON.
  - Спецификация ответов (200, 201, 400, 404, 422) с TypeScript-типами и примерами.

### 4. `search` / `api_search`
Умный поиск эндпоинтов по ключевым словам, путям или описанию.
- **Параметры:** `SearchToolDto` (`query: string`, `tag?: string`, `method?: string`).
- **Алгоритм ранжирования:** Вычисляет релевантность (score) совпадений в путях, тегах, summary и описаниях параметров.

---

## 3. Протокол Model Context Protocol (JSON-RPC 2.0 и SSE)

Модуль полностью реализует официальную спецификацию Model Context Protocol (MCP) с поддержкой Server-Sent Events (SSE) через `@modelcontextprotocol/sdk`:

### Полноценный цикл SSE-транспорта:
1. **Установка SSE-соединения (`GET /api/v1/mcp/sse`):**
   - Создается изолированный экземпляр `McpServer` и транспорт `SSEServerTransport('/api/v1/mcp/messages', res)`.
   - Генерируется уникальный UUID сессии (`sessionId`).
   - Клиенту отправляется стартовое SSE-событие `endpoint`:
     ```text
     event: endpoint
     data: /api/v1/mcp/messages?sessionId=<uuid>
     ```
2. **Отправка команд клиентом (`POST /api/v1/mcp/messages?sessionId=<uuid>`):**
   - Клиент отправляет JSON-RPC запросы (`initialize`, `notifications/initialized`, `tools/list`, `tools/call`, `ping`).
   - Сервер мгновенно подтверждает прием сообщений асинхронным HTTP-статусом `202 Accepted`.
   - Результаты вычислений и JSON-RPC ответы стримятся сервером обратно в открытый SSE-поток (`event: message`).
3. **Обратная совместимость (`POST /api/v1/mcp`):**
   - Если передан `sessionId` (в query, заголовке `x-session-id` или теле), запрос перенаправляется в асинхронный SSE-транспорт.
   - При отсутствии `sessionId` запрос обрабатывается синхронно через `McpService.handleJsonRpc` с возвратом статуса `200 OK` (для REST/curl вызовов без SSE).
4. **Мониторинг сервера (`GET /api/v1/mcp/status`):**
   - Возвращает технический статус `{ "status": "ok", "service": "shelf-api-mcp", "version": "1.0.0", "activeSessions": 0, "toolsCount": 4 }`.

## 4. Сервис форматирования схем (`McpSchemaFormatterService`)

- **Рекурсивный обход схем (`formatSchemaToTypeScript`):** Преобразует OpenAPI 3.0 Schemas (включая `oneOf`, `anyOf`, `allOf`, `enum`, вложенные объекты и массивы) в синтаксически корректные TypeScript interface/type определения.
- **Разрешение ссылок (`$ref`):** Автоматически разыменовывает компоненты `#/components/schemas/...` с защитой от зацикливания (`refStack`).
- **Генерация примеров (`generateExampleJson`):** Формирует валидные JSON-примеры на основе полей `example`, `default` или синтетических дефолтов типов.

---

## 5. REST API Эндпоинты

**Базовый префикс:** `/api/v1/mcp`

- `GET /api/v1/mcp/tools` — Список инструментов MCP.
- `POST /api/v1/mcp/tools/:toolName` — Выполнить конкретный инструмент по имени в URL (например, `/tools/describe`) или через `/tools/execute` с телом `{ "tool": "describe", "arguments": { ... } }`.
- `GET /api/v1/mcp/help` — Руководство по API.
- `GET /api/v1/mcp/index` — Каталог маршрутов.
- `GET /api/v1/mcp/describe?path=...&method=...` — Описание маршрута и схем.
- `GET /api/v1/mcp/search?query=...` — Поиск маршрутов.
- `POST /api/v1/mcp` — JSON-RPC 2.0 транспорт (поддерживает `initialize`, `tools/list`, `tools/call`, `ping`, `notifications/initialized`, с поддержкой маршрутизации по `sessionId`).
- `GET /api/v1/mcp/sse` — SSE транспорт для установки сессии.
- `POST /api/v1/mcp/messages?sessionId=<uuid>` — приём JSON-RPC сообщений для активной SSE сессии (возвращает `202 Accepted`).
- `GET /api/v1/mcp/status` — статус сервера, количество активных сессий и зарегистрированных инструментов.
