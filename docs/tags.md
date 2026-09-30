# Tags Module Specification

Модуль `tags` управляет тегами (метками) для классификации, гибкой фильтрации и цветовой индикации электронных компонентов (например: SMD, THT, RoHS, Опытный образец, Автомобильный класс).

## 1. Схема данных и Entity

### `Tag` (`src/modules/tags/entities/tag.entity.ts`)
Наследует `AbstractBaseEntity` (`id: UUID`, `createdAt`, `updatedAt`).

- **Таблица:** `tags`
- **Индексы:** Уникальный индекс `idx_tags_name` по полю `name`.
- **Поля:**
  - `id: string` — UUID тега.
  - `name: string` — Уникальное имя тега (`varchar(100)`, case-insensitive уникальность на уровне логики сервиса).
  - `color?: string | null` — HEX-код цвета или CSS-токен (`varchar(30)`, nullable), например `"#3B82F6"`, `"#EF4444"`.

---

## 2. DTO и правила валидации

### `CreateTagDto` (`src/modules/tags/dto/create-tag.dto.ts`)
- `name: string` — **Обязательно**, строка от 1 до 100 символов, обрезаются пробелы (`trim`).
- `color?: string` — Опционально, HEX-код цвета формата `^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$` или `null`.

### `UpdateTagDto` (`src/modules/tags/dto/update-tag.dto.ts`)
- Все поля опциональны (`name`, `color`).

---

## 3. Бизнес-логика (`TagsService`)

- **Уникальность имени:** Регистронезависимая проверка имени (`ILike`) перед созданием и обновлением. При совпадении выбрасывается `409 ConflictException`.
- **Множественная загрузка (`findByIds`):** Загрузка списка тегов по массиву UUID через оператор `In(ids)` (используется модулем `parts`).

---

## 4. REST API Эндпоинты

**Базовый префикс:** `/api/v1/tags`

### `POST /api/v1/tags`
Создание нового тега.
- **Тело запроса:** `CreateTagDto`
- **Ответ `201 Created`:** `Tag`
- **Ошибки:** `409 Conflict` (тег с таким именем уже существует).

### `GET /api/v1/tags`
Получение списка тегов с возможностью поиска.
- **Query параметры:**
  - `search?: string` — Поиск по подстроке имени (регистронезависимый `ILike %search%`).
- **Сортировка:** `name ASC`.
- **Ответ `200 OK`:** `Tag[]`

### `GET /api/v1/tags/:id`
Получить тег по UUID.
- **Ответы:** `200 OK` (`Tag`), `404 Not Found`.

### `PATCH /api/v1/tags/:id`
Обновление тега.
- **Тело запроса:** `UpdateTagDto`
- **Ответы:**
  - `200 OK`: `Tag`
  - `409 Conflict`: Новое имя конфликтует с существующим тегом.
  - `404 Not Found`: Тег не найден.

### `DELETE /api/v1/tags/:id`
Удаление тега.
- **Ответы:**
  - `204 No Content`
  - `404 Not Found`
