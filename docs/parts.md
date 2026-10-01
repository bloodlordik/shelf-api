# Parts Module Specification

Модуль `parts` является центральным ядром системы складского учёта. Он управляет каталогом электронных компонентов, динамическими характеристиками (EAV + денормализованный JSONB-снимок), фильтрацией любой сложности, складскими карточками и связями с движениями и историей.

## 1. Схема базы данных (Entities)

### `Part` (`src/modules/parts/entities/part.entity.ts`)
Сущность детали / электронного компонента. Наследует `AbstractBaseEntity`.

- **Таблица:** `parts`
- **Индексы:**
  - Уникальный индекс `idx_parts_sku` по `sku`.
  - Индекс `idx_parts_category_id` по `category_id`.
  - Индекс `idx_parts_name` по `name`.
  - GIN-индекс `idx_parts_attributes_snapshot` по JSONB-колонке `attributes_snapshot`.
  - Индекс `idx_parts_created_by` по `created_by`.
- **Поля:**
  - `id: string` — UUID детали.
  - `sku: string` — Уникальный артикул / партномер (`varchar(100)`), например `"RES-0805-10K-1%"`.
  - `name: string` — Название детали (`varchar(255)`), например `"Резистор SMD 10 кОм 0805 1%"`.
  - `description?: string | null` — Расширенное описание / примечания (`text`).
  - `categoryId?: string | null` — UUID категории (`onDelete: 'SET NULL'`).
  - `category?: Category | null` — Связанная категория (`ManyToOne`).
  - `tags?: Tag[]` — Коллекция тегов детали (`ManyToMany` через таблицу `parts_tags`).
  - `quantity: number` — Текущий доступный остаток на складе (`integer`, default `0`). *Изменяется только через складские движения*.
  - `location?: string | null` — Место хранения / адрес ячейки на складе (`varchar(100)`), например `"Стеллаж A-02 / Полка 3 / Ячейка 14"`.
  - `attributesSnapshot: Record<string, unknown>` — Денормализованный снимок характеристик в формате JSONB для мгновенной фильтрации и индексации.
  - `createdBy?: number | null` — ID актора, создавшего деталь.
  - `createdAt: Date`, `updatedAt: Date`.

### `AttributeValue` (`src/modules/parts/entities/attribute-value.entity.ts`)
Нормализованное EAV-значение атрибута конкретной детали. Наследует `AbstractBaseEntity`.

- **Таблица:** `attribute_values`
- **Индексы:** `idx_attr_values_part_def` по `(part_id, attribute_definition_id)`.
- **Поля:**
  - `id: string` — UUID записи.
  - `partId: string` — FK на `Part` (`onDelete: 'CASCADE'`).
  - `attributeDefinitionId: string` — FK на `AttributeDefinition` (`onDelete: 'CASCADE'`).
  - `valueString?: string | null` — Строковое значение.
  - `valueNumber?: number | null` — Числовое значение.
  - `valueBoolean?: boolean | null` — Булево значение.
  - `valueDate?: Date | null` — Значение даты.
  - `valueOptionId?: string | null` — FK на `AttributeOption` (`onDelete: 'SET NULL'`).
  - `valueReferenceId?: string | null` — Внешний UUID-референс.

---

## 2. Сервисы модуля

### 1. `PartsService` (`src/modules/parts/services/parts.service.ts`)
- **Транзакционность:** Все мутирующие операции (`create`, `update`, `replaceAttributes`, `remove`) выполняются внутри `dataSource.transaction`.
- **Управление атрибутами:**
  - Валидация через `AttributesValidationService`.
  - Запись нормализованных `AttributeValue`.
  - Генерация денормализованного JSONB-снимка через `PartsSnapshotService`.
  - Вычисление и сохранение аудита изменений через `AttributeHistoryService`.
- **Создание (`create`):**
  - Проверяет уникальность `sku`.
  - Привязывает категорию и теги.
  - Сохраняет автора (`actorId` из заголовка `x-actor-id` или тела запроса через `ActorsService.ensureActorExists`).
- **Сводка (`getSummary`):**
  - Подсчитывает `totalParts`, `totalQuantity`, `lowStockCount` (количество $\le 5$) и `outOfStockCount` (количество $= 0$).

### 2. `PartsCardFacade` (`src/modules/parts/services/parts-card.facade.ts`)
Фасад для формирования полной обогащенной карточки детали (`PartCardResponseDto`):
- Разворачивает цепочку родительских категорий (хлебные крошки).
- Преобразует нормализованные значения EAV в сгруппированные типизированные атрибуты с подстановкой единиц измерения и меток опций.
- Добавляет метаданные складских движений (общее количество операций и последнее движение).

### 3. `PartsFilterService` (`src/modules/parts/services/parts-filter.service.ts`)
Высокопроизводительный сервис фильтрации и поиска деталей:
- **Полнотекстовый поиск (`search`):** Поиск по подстроке в `name`, `sku`, `description`, `location`.
- **Иерархическая фильтрация категорий (`categoryId`):** Автоматически включает детали из всех дочерних подкатегорий любого уровня вложенности.
- **Строгая фильтрация по тегам (`tagIds`):** Логика `AND` — выбираются только те детали, которые содержат **все** указанные теги.
- **Динамическая фильтрация по атрибутам (`attr[...]`):**
  - Безопасная валидация ключей атрибутов через regex `/^[a-zA-Z0-9_]{1,64}$/`.
  - Параметризованные SQL-запросы с проверкой типов `jsonb_typeof` для предотвращения SQL-инъекций и ошибок некорректного каста типов.
  - Поддерживает точные совпадения и операторы сравнения (`gte`, `lte`, `eq`, скаляры и массивы).
  - Выполняет запросы к JSONB-колонке `attributes_snapshot` с использованием PostgreSQL JSONB-операторов (`@>`, `->`, `->>`, `?`).

### 4. `PartsSnapshotService` (`src/modules/parts/services/parts-snapshot.service.ts`)
Генерирует компактную JSONB-структуру `attributesSnapshot`:
- Нормализует ключи тегов (`tags: ["smd", "rohs"]`).
- Записывает значения атрибутов по их системным ключам.
- Сохраняет метаинформацию `_meta` с единицами измерения и названиями опций.

---

## 3. REST API Эндпоинты

**Базовый префикс:** `/api/v1/parts`

### `POST /api/v1/parts`
Создать новый компонент.
- **Headers:** `x-actor-id?: number`
- **Тело запроса (`CreatePartDto`):**
```json
{
  "sku": "RES-0805-10K",
  "name": "Резистор SMD 10кОм 0805 1%",
  "description": "Точный тонкопленочный резистор",
  "categoryId": "c9a4b882-75d3-4f91-a6e5-4a7b71941234",
  "tagIds": ["d1b4b882-75d3-4f91-a6e5-4a7b71945678"],
  "location": "Ячейка A-12",
  "actorId": 42,
  "attributes": [
    { "key": "nominal_resistance", "value": 10000 },
    { "key": "tolerance", "value": "1%" }
  ]
}
```
- **Ответ `201 Created`:** Сущность `Part`.

### `GET /api/v1/parts`
Поиск и фильтрация компонентов.
- **Query параметры (`PartFilterDto`):**
  - `page?: number`, `limit?: number`
  - `search?: string`
  - `categoryId?: string`
  - `tagIds?: string[]` (повторяющиеся параметры `tagIds=...&tagIds=...` или через запятую)
  - `minQuantity?: number`, `maxQuantity?: number`
  - `sortBy?: 'name' | 'sku' | 'quantity' | 'createdAt' | 'updatedAt'`
  - `sortOrder?: 'ASC' | 'DESC'`
  - `attr[<key>]=<value>` или `attr[<key>][gte]=<value>`
- **Ответ `200 OK`:** `PaginatedResponseDto<Part>`

### `GET /api/v1/parts/summary`
Сводная статистика каталога.
- **Ответ `200 OK` (`PartsSummaryDto`):**
```json
{
  "totalParts": 1450,
  "totalQuantity": 84200,
  "lowStockCount": 12,
  "outOfStockCount": 3
}
```

### `GET /api/v1/parts/:id`
Полная карточка компонента.
- **Ответ `200 OK` (`PartCardResponseDto`):** Детальный объект с категорией, хлебными крошками, тегами, форматированными атрибутами и статистикой движений.

### `PATCH /api/v1/parts/:id`
Частичное обновление компонента (`UpdatePartDto`).

### `PUT /api/v1/parts/:id/attributes`
Полная замена набора характеристик компонента (`ReplacePartAttributesDto`: `{ actorId?: number, attributes: PartAttributeValueInputDto[] }`).
- **Ответы:** `200 OK` (сущность `Part`), `400 Bad Request` (ошибка структуры тела), `422 Unprocessable Entity` (ошибка валидации динамических EAV-атрибутов), `404 Not Found`.
### `DELETE /api/v1/parts/:id`
Удаление компонента.

### `GET /api/v1/parts/:id/movements`
Журнал складских движений по детали (`StockMovementFilterDto`).

### `POST /api/v1/parts/:id/movements`
Проведение складского движения по детали (`CreateStockMovementDto`).

### `GET /api/v1/parts/:id/attributes/history`
История изменений атрибутов конкретной детали (`AttributeHistoryFilterDto`).
