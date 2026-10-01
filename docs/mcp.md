# Model Context Protocol (MCP) Module Specification

Модуль `mcp` реализует интеграцию с Model Context Protocol (MCP) и предоставляет специализированный API для AI-агентов и LLM, позволяя им исследовать спецификацию OpenAPI, понимать схемы данных, генерировать TypeScript-типы и безопасно вызывать эндпоинты.

## 1. Архитектура и инициализация

- **Контроллер:** `McpController` (`src/modules/mcp/mcp.controller.ts`)
- **Сервисы:**
  - `McpService` (`src/modules/mcp/services/mcp.service.ts`)
  - `McpSchemaFormatterService` (`src/modules/mcp/services/mcp-schema-formatter.service.ts`)
- **Инициализация документа:** В `main.ts` сгенерированный Swagger/OpenAPI документ регистрируется в сервисе:
  ```typescript
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  mcpService.setOpenApiDocument(document);
  ```

---

## 2. Доступные MCP Инструменты (Tools)

### 1. `api_help`
Возвращает руководство для AI-агента по эффективной навигации и работе с API.
- **Параметры:** `HelpToolDto` (`topic?: 'overview' | 'workflow' | 'filtering' | 'stock' | 'attributes'`).
- **Результат:** Форматированный Markdown с инструкциями и примерами сценариев.

### 2. `api_index`
Предоставляет каталог всех эндпоинтов API с группировкой по тегам/модулям.
- **Параметры:** `IndexToolDto` (`tag?: string`, `includeDeprecated?: boolean`).
- **Результат:** Таблица доступных маршрутов, HTTP-методов и кратких описаний.

### 3. `api_describe`
Выполняет глубокую интроспекцию конкретного эндпоинта.
- **Параметры:** `DescribeToolDto` (`path: string`, `method: string`).
- **Результат:** Полное описание эндпоинта:
  - Query и Path параметры с типами и признаком обязательности.
  - TypeScript-определение структуры Request Body с примером JSON.
  - Спецификация ответов (200, 201, 400, 404, 422) с TypeScript-типами и примерами.

### 4. `api_search`
Умный поиск эндпоинтов по ключевым словам, путям или описанию.
- **Параметры:** `SearchToolDto` (`query: string`, `tag?: string`, `method?: string`, `limit?: number`).
- **Алгоритм ранжирования:** Вычисляет релевантность (score) совпадений в путях, тегах, summary и описаниях параметров.

---

## 3. Протокол JSON-RPC 2.0 и SSE

Модуль поддерживает стандартный протокол MCP:
- **`POST /api/v1/mcp`** — Обработка JSON-RPC 2.0 сообщений:
  - `initialize` — Возвращает информацию о сервере, версию протокола и возможности (`capabilities.tools`).
  - `tools/list` — Список схем инструментов в формате JSON Schema.
  - `tools/call` — Выполнение инструмента с передачей аргументов `params.arguments`.
  - `notifications/initialized` — Подтверждение готовности сессии.
- **`GET /api/v1/mcp/sse`** — Долгоживущий Server-Sent Events поток для двунаправленной коммуникации по протоколу MCP с автоматическим keepalive-пингом каждые 15 секунд (`endpoint` + `interval ping`).

---

## 4. Сервис форматирования схем (`McpSchemaFormatterService`)

- **Рекурсивный обход схем (`formatSchemaToTypeScript`):** Преобразует OpenAPI 3.0 Schemas (включая `oneOf`, `anyOf`, `allOf`, `enum`, вложенные объекты и массивы) в синтаксически корректные TypeScript interface/type определения.
- **Разрешение ссылок (`$ref`):** Автоматически разыменовывает компоненты `#/components/schemas/...` с защитой от зацикливания (`refStack`).
- **Генерация примеров (`generateExampleJson`):** Формирует валидные JSON-примеры на основе полей `example`, `default` или синтетических дефолтов типов.

---

## 5. REST API Эндпоинты

**Базовый префикс:** `/api/v1/mcp`

- `GET /api/v1/mcp/tools` — Список инструментов MCP.
- `POST /api/v1/mcp/tools/execute` — Выполнить инструмент по имени (`{ "tool": "api_describe", "arguments": { ... } }`).
- `GET /api/v1/mcp/help` — Руководство по API.
- `GET /api/v1/mcp/index` — Каталог маршрутов.
- `GET /api/v1/mcp/describe?path=...&method=...` — Описание маршрута и схем.
- `GET /api/v1/mcp/search?query=...` — Поиск маршрутов.
- `POST /api/v1/mcp` — JSON-RPC 2.0 транспорт.
- `GET /api/v1/mcp/sse` — SSE транспорт.
