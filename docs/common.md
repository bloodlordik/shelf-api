# Common Infrastructure & Base Specifications

Модуль `common` содержит общие базовые сущности, DTO, фильтры исключений и доменные ошибки, используемые всеми функциональными модулями `shelf-api`.

## 1. Базовые сущности (Entities)

### `AbstractBaseEntity` (`src/common/entities/abstract-base.entity.ts`)
Абстрактный базовый класс для TypeORM-сущностей, предоставляющий стандартные поля первичного ключа и временных меток.

- **Поля:**
  - `id: string` — Первичный ключ `UUID` (генерируется TypeORM `uuid`).
  - `createdAt: Date` — Дата создания записи (`timestamptz`, `CURRENT_TIMESTAMP`, колонка `created_at`).
  - `updatedAt: Date` — Дата последнего обновления записи (`timestamptz`, `CURRENT_TIMESTAMP`, колонка `updated_at`).

---

## 2. Пагинация (DTOs)

### `PaginationDto` (`src/common/dto/pagination.dto.ts`)
Стандартный DTO для query-параметров пагинации.

- **Свойства и валидация:**
  - `page?: number` — Номер страницы (целое число $\ge 1$, по умолчанию `1`).
  - `limit?: number` — Количество записей на страницу (целое число от `1` до `100`, по умолчанию `20`).
- **Геттеры:**
  - `skip: number` — Вычисляет смещение для SQL-запроса: `(page - 1) * limit`.

### `PaginatedResponseDto<T>` (`src/common/dto/paginated-response.dto.ts`)
Унифицированная базовая структура ответа для всех списочных эндпоинтов.

- **Свойства:**
  - `data: T[]` — Массив записей текущей страницы (в OpenAPI уточняется через специализированные подклассы DTO: `PaginatedStockMovementsResponseDto`, `PaginatedCategoriesResponseDto`, `PaginatedPartsResponseDto`).
  - `meta.total: number` — Общее количество записей по запросу.
  - `meta.page: number` — Номер текущей страницы.
  - `meta.limit: number` — Размер страницы.
  - `meta.totalPages: number` — Общее количество страниц (`Math.ceil(total / limit)`).
  - `meta.hasNextPage: boolean` — Флаг наличия следующей страницы (`page < totalPages`).
  - `meta.hasPreviousPage: boolean` — Флаг наличия предыдущей страницы (`page > 1`).
---

## 3. Обработка ошибок и исключения (Exceptions & Filters)

### `TypeOrmExceptionFilter` (`src/common/filters/typeorm-exception.filter.ts`)
Глобальный NestJS Exception Filter для перехвата `QueryFailedError` из TypeORM и маппинга специфичных кодов PostgreSQL в соответствующие HTTP-статусы:

| Код ошибки Postgres | Название | HTTP Статус | Сообщение клиенту |
|---|---|---|---|
| `23505` | `unique_violation` | `409 Conflict` | `A record with this unique value already exists` |
| `23503` | `foreign_key_violation` | `400 Bad Request` | `Foreign key constraint violation: referenced entity does not exist or is in use` |
| `23502` | `not_null_violation` | `400 Bad Request` | `Required column value is missing` |
| `22P02` | `invalid_text_representation` | `400 Bad Request` | `Invalid data format or UUID syntax` |
| *прочие* | Generic DB error | `500 Internal Server Error` | `Internal database error` |

**Формат ответа об ошибке:**
```json
{
  "statusCode": 409,
  "error": "CONFLICT",
  "message": "A record with this unique value already exists",
  "details": "Key (name)=(SMD) already exists.",
  "timestamp": "2026-09-30T10:00:00.000Z"
}
```

### `DomainException` (`src/common/exceptions/domain.exception.ts`)
Базовое доменное исключение приложения (наследует `HttpException`). Позволяет передавать структурированное сообщение, HTTP-статус (по умолчанию `400 Bad Request`) и произвольный объект `details`.

### `AttributeValidationException` (`src/common/exceptions/attribute-validation.exception.ts`)
Специализированное исключение валидации динамических атрибутов (HTTP `422 Unprocessable Entity`). Содержит детальный массив ошибок валидации:

- **Структура элемента ошибки (`AttributeValidationErrorDetail`):**
  - `key?: string` — Символьный ключ атрибута.
  - `attributeDefinitionId?: string` — UUID определения атрибута.
  - `attributeName: string` — Человекочитаемое имя атрибута.
  - `receivedValue: unknown` — Невалидное значение, переданное клиентом.
  - `reason: string` — Описание причины ошибки валидации.
