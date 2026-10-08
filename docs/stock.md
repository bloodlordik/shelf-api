# Stock Movements Module Specification

Модуль `stock` реализует складской учет, фиксацию всех приходов, списаний, инвентаризаций и перемещений компонентов с пессимистической блокировкой строк в транзакциях и гарантией защиты от отрицательных остатков.

## 1. Типы движений (Enum)

### `StockMovementType` (`src/modules/stock/enums/stock-movement-type.enum.ts`)
- `receipt` — Приход (поступление от поставщика, оприходование).
- `writeoff` — Списание (производство, брак, утилизация).
- `correction` — Корректировка остатка по результатам ревизии / инвентаризации.
- `transfer_in` — Входящее перемещение между зонами / складами.
- `transfer_out` — Исходящее перемещение.

---

## 2. Схема базы данных (Entity)

### `StockMovement` (`src/modules/stock/entities/stock-movement.entity.ts`)
- **Таблица:** `stock_movements`
- **Индексы:**
  - `idx_stock_movements_part_perf_at` по `(part_id, performed_at)`.
  - `idx_stock_movements_perf_at` по `performed_at`.
  - `idx_stock_movements_performed_by` по `(performed_by, performed_at)`.
  - `idx_stock_movements_type` по `(movement_type, performed_at)`.
  - `idx_stock_movements_ref_doc` по `reference_doc`.
- **Поля:**
  - `id: string` — UUID записи движения (`PrimaryGeneratedColumn('uuid')`).
  - `partId: string` — FK на `Part` (`onDelete: 'RESTRICT'`).
  - `movementType: StockMovementType` — Тип операции (`varchar(30)`).
  - `quantityDelta: number` — Изменение количества со знаком (`integer`):
    - Положительное при приходе (`receipt`, `transfer_in`).
    - Отрицательное при списании (`writeoff`, `transfer_out`).
    - Произвольное при корректировке (`correction`).
  - `quantityAfter: number` — Итоговый остаток детали сразу после фиксации движения.
  - `reason?: string | null` — Текстовая причина операции (`varchar(500)`, опционально), например `"Брак при монтаже печатной платы"`.
  - `referenceDoc?: string | null` — Ссылка на сопроводительный документ (`varchar(255)`, опционально), например `"ТТН-2026-09-00123"`.
  - `performedBy: number` — Целочисленный ID актора (`FK` на `Actor`, `onDelete: 'RESTRICT'`).
  - `performedAt: Date` — Временная метка проведения операции (`timestamptz`, default `CURRENT_TIMESTAMP`).

---

## 3. Бизнес-логика и правила (`StockMovementsService`)

### Метод `applyMovement(partId, input, manager?)`
Единственная точка входа для изменения количества компонента в системе:
1. **Пессимистическая блокировка:**
   Выполняет `SELECT ... FOR UPDATE` (`pessimistic_write`) записи `Part` для исключения race conditions при конкурентных складских операциях.
2. **Авторегистрация актора:**
   Вызывает `ActorsService.ensureActorExists(performedBy)` для гарантии целостности внешнего ключа.
3. **Проверка знаков и дельты:**
   - Для `receipt` и `transfer_in`: `quantityDelta` должна быть строго $> 0$.
   - Для `writeoff` и `transfer_out`: `quantityDelta` должна быть строго $< 0$ (если передано положительное число, сервис автоматически инвертирует знак).
   - Для `correction`: допускается либо прямое указание `quantityDelta`, либо целевой остаток `targetQuantity` (тогда дельта вычисляется как `targetQuantity - currentQuantity`).
4. **Инвариант неотрицательного остатка:**
   Если `currentQuantity + quantityDelta < 0`, транзакция прерывается с ошибкой `DomainException: "Insufficient stock. Current: X, requested delta: Y"` (HTTP 400).
5. **Атомарная фиксация:**
   В рамках одной транзакции сохраняется запись `StockMovement` и обновляется поле `quantity` сущности `Part`.
6. **Необязательные поля сопроводительной информации:**
   Поля `reason` и `referenceDoc` являются полностью опциональными для всех типов движений (`receipt`, `writeoff`, `correction`, `transfer_in`, `transfer_out`). При передаче пустой строки они нормализуются в `null`.

---

## 4. REST API Эндпоинты

### 1. Маршруты в контексте конкретной детали (`/api/v1/parts/:id/movements`)
- **`POST /api/v1/parts/:id/movements`** — Провести движение по детали.
  - Тело запроса: `CreateStockMovementDto`.
  - Ответ `201 Created`: `StockMovementResponseDto`.
- **`GET /api/v1/parts/:id/movements`** — Получить историю движений конкретной детали.
  - Query параметры (`StockMovementFilterDto`): `type`, `performedBy`, `fromDate` (ISO 8601 `date-time`), `toDate` (ISO 8601 `date-time`), `page`, `limit`.
  - Ответ `200 OK`: `PaginatedStockMovementsResponseDto` (наследует `PaginatedResponseDto<StockMovementResponseDto>` с элементами `StockMovementResponseDto[]`).

### 2. Глобальные маршруты склада (`/api/v1/stock/movements`)
- **`GET /api/v1/stock/movements`** — Глобальный журнал движений по всем деталям склада.
  - Query параметры (`GlobalStockMovementFilterDto`): `partId`, `sku`, `type`, `performedBy`, `fromDate` (ISO 8601 `date-time`), `toDate` (ISO 8601 `date-time`), `page`, `limit`.
  - Ответ `200 OK`: `PaginatedStockMovementsResponseDto` (наследует `PaginatedResponseDto<StockMovementResponseDto>` с элементами `StockMovementResponseDto[]`).
- **`POST /api/v1/stock/movements`** — Создать движение (требует `partId` в теле запроса).
