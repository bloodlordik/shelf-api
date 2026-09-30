# Units Module Specification

Модуль `units` управляет единицами измерения физических величин и упаковок электронных компонентов (например: Ом, Фарад, Вольт, Ампер, мм, шт, кг и др.).

## 1. Схема данных и Enums

### Enum `UnitGroup` (`src/modules/units/enums/unit-group.enum.ts`)
Категории физических величин:
- `length` — Длина / линейные размеры (мм, см, м).
- `mass` — Масса (мг, г, кг).
- `volume` — Объём (мл, л).
- `electrical` — Электрические величины (Ом, кОм, МОм, пФ, нФ, мкФ, В, мВ, А, мА, Гц, кГц, МГц).
- `temperature` — Температурные величины (°C, K).
- `pieces` — Штучные единицы (шт, уп, катушка, лента).
- `other` — Прочие единицы (по умолчанию).

### Сущность `Unit` (`src/modules/units/entities/unit.entity.ts`)
Наследует `AbstractBaseEntity` (`id: UUID`, `createdAt`, `updatedAt`).

- **Таблица:** `units`
- **Поля:**
  - `id: string` — UUID записи.
  - `name: string` — Полное наименование единицы измерения (`varchar(100)`), например `"Миллиметр"`, `"Ом"`.
  - `symbol: string` — Краткое обозначение / символ (`varchar(20)`), например `"мм"`, `"Ω"`, `"В"`.
  - `group: UnitGroup` — Группа единиц (`enum UnitGroup`, default `UnitGroup.OTHER`).

---

## 2. DTO и требования к входным данным

### `CreateUnitDto` (`src/modules/units/dto/create-unit.dto.ts`)
- `name: string` — **Обязательно**, строка от 1 до 100 символов.
- `symbol: string` — **Обязательно**, строка от 1 до 20 символов.
- `group?: UnitGroup` — Опционально, значение из `UnitGroup`, по умолчанию `UnitGroup.OTHER`.

### `UpdateUnitDto` (`src/modules/units/dto/update-unit.dto.ts`)
- Все поля опциональны (`name`, `symbol`, `group`).

---

## 3. REST API Эндпоинты

**Базовый префикс:** `/api/v1/units`

### `POST /api/v1/units`
Создать новую единицу измерения.
- **Тело запроса:** `CreateUnitDto`
- **Ответ `201 Created`:** Объект `Unit`.

### `GET /api/v1/units`
Получить список всех единиц измерения.
- **Query параметры:**
  - `group?: UnitGroup` — Фильтрация по группе единиц.
- **Сортировка:**
  - При наличии фильтра по группе: `name ASC`.
  - Без фильтра: `group ASC, name ASC`.
- **Ответ `200 OK`:** `Unit[]`

### `GET /api/v1/units/:id`
Получить единицу измерения по UUID.
- **Параметры:** `id` (UUID).
- **Ответы:**
  - `200 OK`: `Unit`
  - `404 Not Found`: если единица измерения не найдена.

### `PATCH /api/v1/units/:id`
Частичное обновление параметров единицы измерения.
- **Параметры:** `id` (UUID).
- **Тело запроса:** `UpdateUnitDto`
- **Ответы:**
  - `200 OK`: Обновленный объект `Unit`.
  - `404 Not Found`: если единица измерения не найдена.

### `DELETE /api/v1/units/:id`
Удаление единицы измерения.
- **Параметры:** `id` (UUID).
- **Ответы:**
  - `204 No Content`: Успешное удаление.
  - `400 Bad Request`: Ошибка внешнего ключа (если единица используется в определениях атрибутов).
  - `404 Not Found`: Единица измерения не найдена.
