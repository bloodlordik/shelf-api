# Attributes Module Specification

Модуль `attributes` реализует EAV (Entity-Attribute-Value) систему с поддержкой динамических характеристик деталей, строгой валидацией типов данных, справочниками вариантов значений (Select / Multiselect) и полным аудитом истории изменений.

## 1. Типы данных и Enums

### Enum `AttributeDataType` (`src/modules/attributes/enums/attribute-data-type.enum.ts`)
Поддерживаемые типы характеристик:
- `string` — Текстовая строка.
- `number` — Числовое значение (целое или с плавающей точкой).
- `boolean` — Логическое значение (`true`/`false`).
- `date` — Дата/время (ISO 8601).
- `select` — Одиночный выбор из предопределенного справочника опций.
- `multiselect` — Множественный выбор из справочника опций.
- `reference` — Ссылка на стороннюю сущность (валидный UUID).

### Enum `AttributeChangeType` (`src/modules/attributes/enums/attribute-change-type.enum.ts`)
Типы операций в журнале аудита:
- `added` — Добавление нового значения атрибута.
- `modified` — Изменение существующего значения.
- `deleted` — Удаление значения атрибута.

---

## 2. Схема базы данных (Entities)

### `AttributeDefinition` (`src/modules/attributes/entities/attribute-definition.entity.ts`)
Определение динамического атрибута. Наследует `AbstractBaseEntity`.
- **Таблица:** `attribute_definitions`
- **Поля:**
  - `id: string` — UUID определения.
  - `key: string` — Уникальный системный ключ (`varchar(100)`, уникальный индекс `idx_attribute_defs_key`), например `"nominal_resistance"`, `"tolerance"`.
  - `name: string` — Отображаемое имя (`varchar(150)`), например `"Номинальное сопротивление"`.
  - `dataType: AttributeDataType` — Тип данных атрибута.
  - `isRequired: boolean` — Флаг обязательности заполнения (default `false`).
  - `isMultiple: boolean` — Поддержка нескольких значений для одного атрибута (default `false`).
  - `unitId?: string | null` — Ссылка на единицу измерения (`Unit`, `onDelete: 'SET NULL'`).
  - `description?: string | null` — Пояснение/описание атрибута.
  - `defaultValue?: string | null` — Значение по умолчанию в сериализованном виде.
  - `options?: AttributeOption[]` — Связанные опции (для `select`/`multiselect`).

### `AttributeOption` (`src/modules/attributes/entities/attribute-option.entity.ts`)
Вариант значения для справочных атрибутов (`select`/`multiselect`). Наследует `AbstractBaseEntity`.
- **Таблица:** `attribute_options`
- **Индексы:** Уникальный составной индекс `idx_attribute_options_def_val` по `(attribute_definition_id, value)`.
- **Поля:**
  - `id: string` — UUID опции.
  - `attributeDefinitionId: string` — FK на `AttributeDefinition`.
  - `value: string` — Системное значение опции (`varchar(100)`), например `"0805"`, `"1206"`, `"5%"`.
  - `label: string` — Отображаемая метка (`varchar(150)`), например `"SMD 0805"`, `"±5%"`.
  - `sortOrder: number` — Порядок сортировки (default `0`).
  - `isDefault: boolean` — Опция по умолчанию (default `false`).

### `AttributeValueHistory` (`src/modules/attributes/entities/attribute-value-history.entity.ts`)
Журнал аудита всех изменений атрибутов компонентов.
- **Таблица:** `attribute_value_history`
- **Индексы:** `(part_id, changed_at)`, `(attribute_definition_id, changed_at)`, `(changed_by, changed_at)`.
- **Поля:**
  - `id: string` — UUID записи аудита.
  - `partId: string` — FK на деталь (`Part`, `onDelete: 'CASCADE'`).
  - `attributeDefinitionId: string` — FK на `AttributeDefinition`.
  - `changeType: AttributeChangeType` — `added` | `modified` | `deleted`.
  - `oldValueString`, `newValueString` — Старое и новое строковое значение.
  - `oldValueNumber`, `newValueNumber` — Старое и новое числовое значение.
  - `oldValueBoolean`, `newValueBoolean` — Старое и новое булево значение.
  - `oldValueDate`, `newValueDate` — Старая и новая дата.
  - `oldValueOptionId`, `newValueOptionId` — FK на старую и новую опцию (`AttributeOption`).
  - `oldValueReferenceId`, `newValueReferenceId` — Старый и новый reference UUID.
  - `changedBy: number` — Целочисленный ID актора.
  - `changedAt: Date` — Время совершения изменения.

---

## 3. Сервисы модуля

### 1. `AttributeDefinitionsService` (`src/modules/attributes/services/attributes-definition.service.ts`)
- CRUD для определений атрибутов (`createDefinition`, `findAllDefinitions`, `findDefinitionById`, `findDefinitionByKey`, `updateDefinition`, `removeDefinition`).
- Управление вариантами опций (`createOption`, `findOptionById`, `updateOption`, `removeOption`).
- Автоматическая валидация: проверка существования связанного `unitId`, проверка уникальности `key` и `value` опций.

### 2. `AttributesValidationService` (`src/modules/attributes/services/attributes-validation.service.ts`)
Движок валидации входных данных атрибутов деталей:
- Принимает массив сырых значений `RawAttributeInput` (`{ key?: string, attributeDefinitionId?: string, value: unknown }`).
- Загружает определения атрибутов по `id` или `key` и все активные опции.
- Проверяет обязательные атрибуты (`isRequired`).
- Проверяет кардинальность: для одиночных атрибутов запрещает массивы; для `isMultiple` / `multiselect` допускает массив значений.
- Выполняет строгое приведение и валидацию типов:
  - `number`: валидация `!isNaN(Number(v))`.
  - `boolean`: поддержка булевых значений и строк `"true"`, `"false"`, `"1"`, `"0"`.
  - `date`: парсинг ISO 8601 и валидация даты.
  - `select` / `multiselect`: проверка, что переданное значение соответствует `id` или `value` существующей опции в определении.
  - `reference`: проверка соответствия формату UUID v4.
- При наличии любых ошибок выбрасывает `AttributeValidationException` (HTTP 422) со всеми деталями нарушений.

### 3. `AttributeHistoryService` (`src/modules/attributes/services/attribute-history.service.ts`)
- `recordAttributeDiff(partId, oldValues, newValues, changedBy, manager)` — Вычисляет разницу (diff) между старым и новым набором значений детали и атомарно регистрирует записи аудита в транзакции.
- `getHistoryByPart(partId, filterDto)` — Пагинированная история изменений атрибутов по конкретной детали.
- `getHistoryByDefinition(definitionId, filterDto)` — Пагинированная история изменений по определению атрибута среди всех деталей.

---

## 4. REST API Эндпоинты

**Базовый префикс:** `/api/v1/attributes`

### Определения атрибутов
- `POST /api/v1/attributes/definitions` — Создать определение атрибута (`CreateAttributeDefinitionDto`).
- `GET /api/v1/attributes/definitions` — Получить список всех определений атрибутов (включая связанные опции и единицы измерения).
- `GET /api/v1/attributes/definitions/:id` — Получить определение атрибута по UUID.
- `PATCH /api/v1/attributes/definitions/:id` — Обновить определение атрибута (`UpdateAttributeDefinitionDto`).
- `DELETE /api/v1/attributes/definitions/:id` — Удалить определение атрибута.

### Опции атрибутов
- `POST /api/v1/attributes/definitions/:id/options` — Добавить вариант значения к атрибуту (`CreateAttributeOptionDto`).
- `PATCH /api/v1/attributes/options/:optionId` — Обновить опцию (`UpdateAttributeOptionDto`).
- `DELETE /api/v1/attributes/options/:optionId` — Удалить опцию.

### История изменений
- `GET /api/v1/attributes/history/part/:partId` — Получить историю изменений атрибутов детали (поддерживает фильтрацию по `attributeDefinitionId`, `changeType`, `actorId`, `startDate`, `endDate` и пагинацию).
- `GET /api/v1/attributes/history/definition/:definitionId` — Получить историю изменений по атрибуту по всей базе деталей.
