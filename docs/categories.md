# Categories Module Specification

Модуль `categories` реализует иерархический каталог категорий электронных компонентов (дерево категорий с неограниченной вложенностью, хлебными крошками и защитой от циклических зависимостей).

## 1. Схема данных и Entity

### `Category` (`src/modules/categories/entities/category.entity.ts`)
Наследует `AbstractBaseEntity` (`id: UUID`, `createdAt`, `updatedAt`).

- **Таблица:** `categories`
- **Индексы:**
  - `idx_categories_parent_id` по колонке `parent_id`.
  - `idx_categories_code` уникальный индекс по `code` (при `code IS NOT NULL`).
- **Связи:**
  - Self-referencing ManyToOne `parent` (`parentId?: string | null`, `onDelete: 'RESTRICT'`).
  - OneToMany `children` (`children?: Category[]`).
- **Поля:**
  - `id: string` — UUID категории.
  - `name: string` — Название категории (`varchar(150)`), например `"Резисторы SMD"`.
  - `code?: string | null` — Уникальный символьный код (`varchar(100)`, nullable), например `"resistors_smd"`.
  - `parentId?: string | null` — UUID родительской категории.

---

## 2. DTO и структуры данных

### `CreateCategoryDto` (`src/modules/categories/dto/create-category.dto.ts`)
- `name: string` — **Обязательно**, 1–150 символов.
- `code?: string` — Опционально, 1–100 символов, регулярное выражение `^[a-z0-9_-]+$` (только строчные латинские буквы, цифры, дефис и подчеркивание).
- `parentId?: string` — Опционально, валидный UUID существующей родительской категории.

### `UpdateCategoryDto` (`src/modules/categories/dto/update-category.dto.ts`)
- Опциональные поля: `name`, `code`, `parentId`.

### `CategoryTreeDto` (`src/modules/categories/dto/category-tree.dto.ts`)
- Структура узла дерева категорий:
  - `id: string`, `name: string`, `code?: string | null`, `parentId?: string | null`, `children: CategoryTreeDto[]`.

### `CategoryBreadcrumbDto` (`src/modules/categories/dto/category-tree.dto.ts`)
- Элемент пути хлебных крошек:
  - `id: string`, `name: string`, `code?: string | null`, `level: number`.

### `CategoryResponseDto` и `PaginatedCategoriesResponseDto` (`src/modules/categories/dto/category-response.dto.ts`)
- Базовый ответ категории:
  - `id: string`, `name: string`, `code?: string | null`, `parentId?: string | null`, `createdAt: Date`, `updatedAt: Date`.
- Пагинированный список:
  - `data: CategoryResponseDto[]`
  - `meta: PaginationMetaDto`

### `CategoryDetailResponseDto` (`src/modules/categories/dto/category-response.dto.ts`)
- Детальный ответ категории:
  - Данные сущности `Category`.
  - `breadcrumbs: CategoryBreadcrumbDto[]` — Массив хлебных крошек от корня дерева до текущей категории.
---

## 3. Бизнес-логика (`CategoriesService`)

1. **Защита от циклов при обновлении (`detectCycle`):**
   При изменении `parentId` сервис рекурсивно проверяет цепочку предков нового родителя. Категория не может быть назначена родителем самой себе или любому из своих потомков. При нарушении выбрасывается `400 BadRequestException: "Cycle detected in category hierarchy"`.
2. **Построение дерева (`getTree`):**
   Загружает все категории одним запросом и строит иерархическую структуру `children[]` в памяти.
3. **Рекурсивный поиск подкатегорий (`getAllSubcategoryIds`):**
   Выполняется через SQL Recursive CTE (`WITH RECURSIVE sub_tree AS ...`), возвращая плоский массив UUID переданной категории и всех её потомков на всю глубину иерархии без загрузки всего каталога в память Node.js.
4. **Хлебные крошки (`getBreadcrumbs`):**
   Формирует упорядоченный массив от корневой категории до целевой через SQL Recursive CTE (`WITH RECURSIVE cat_tree AS ...`).
---

## 4. REST API Эндпоинты

**Базовый префикс:** `/api/v1/categories`

### `POST /api/v1/categories`
Создать категорию.
- **Тело запроса:** `CreateCategoryDto`
- **Ответ `201 Created`:** `Category`
- **Ошибки:** `400 Bad Request` (неверный parentId), `409 Conflict` (дубликат code).

### `GET /api/v1/categories/tree`
Получить полное иерархическое дерево категорий.
- **Ответ `200 OK`:** `CategoryTreeDto[]`

### `GET /api/v1/categories`
Получить плоский список категорий с пагинацией.
- **Query параметры:** `page?: number`, `limit?: number`.
- **Ответ `200 OK`:** `PaginatedCategoriesResponseDto` (список `CategoryResponseDto` и метаданные пагинации).
### `GET /api/v1/categories/:id`
Получить категорию по UUID с хлебными крошками и счётчиком подкатегорий.
- **Ответы:** `200 OK` (`CategoryDetailResponseDto`), `404 Not Found`.

### `PATCH /api/v1/categories/:id`
Обновить категорию (с защитой от циклов).
- **Тело запроса:** `UpdateCategoryDto`
- **Ответы:** `200 OK` (`Category`), `400 Bad Request` (цикл), `404 Not Found`.

### `DELETE /api/v1/categories/:id`
Удалить категорию.
- **Ответы:**
  - `204 No Content`
  - `400 Bad Request`: Категория имеет дочерние подкатегории или привязана к деталям (`RESTRICT`).
  - `404 Not Found`
