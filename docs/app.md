# Application Core & Bootstrap Specification

Документ описывает глобальную архитектуру, точку входа (`src/main.ts`), корневой модуль (`src/app.module.ts`), безопасность, глобальные пайпы, фильтры и интеграцию с базой данных.

## 1. Точка входа (`src/main.ts`)

### Конфигурация и запуск приложения
1. **Безопасность (Helmet):**
   - Настроена Content Security Policy (CSP) для Swagger UI (`validator.swagger.io`, `unsafe-inline`, `data:`, `upgradeInsecureRequests: null` для работы без принудительного HTTPS по локальным IP).
   - Отключены `crossOriginOpenerPolicy` и `originAgentCluster` для исключения предупреждений браузера при HTTP-доступе.
2. **CORS:**
   - Чтение переменной `CORS_ORIGIN`. Поддержка `*`, одиночных доменов или списков через запятую. Флаг `credentials: true`.
3. **Глобальная валидация (ValidationPipe):**
   - `whitelist: true` — Автоматическое удаление полей, не описанных в DTO.
   - `transform: true` — Автоматическая трансформация входящих полезных нагрузок в экземпляры DTO-классов.
   - `enableImplicitConversion: true` — Автоматическое приведение примитивных типов (строки в числа, булевы значения).
4. **Глобальный фильтр ошибок:**
   - Подключение `TypeOrmExceptionFilter` для перехвата и нормализации ошибок PostgreSQL (уникальность, внешние ключи, NOT NULL).
5. **Префиксы и версионирование API:**
   - Глобальный префикс: `api`.
   - Исключения из глобального префикса: `admin`, `admin/{*path}`, `health`, `health/{*path}`.
   - Версионирование: URI-версионирование (`VersioningType.URI`), версия по умолчанию — `1` (`/api/v1/...`).
6. **Swagger / OpenAPI:**
   - Документация доступна по пути `/api/docs` (при `SWAGGER_ENABLED=true`).
   - Автоматическая передача сгенерированного OpenAPI документа в `McpService`.
7. **Shutdown Hooks:**
   - Включены `app.enableShutdownHooks()` для корректного завершения соединений с БД при остановке контейнера/процесса.

---

## 2. Корневой модуль (`src/app.module.ts`)

### Зависимости и провайдеры
- **`ConfigModule`:** Глобальный модуль конфигурации с загрузкой `.env` файлов и валидацией через `validate` из `src/config/env.validation.ts`.
- **`TypeOrmModule`:** Асинхронная инициализация подключения к PostgreSQL:
  - `type: 'postgres'`
  - `host`, `port`, `username`, `password`, `database` из `ConfigService`.
  - `synchronize`: управляется через `DB_SYNCHRONIZE` (по умолчанию `true` в `development`).
  - `autoLoadEntities: true` — Автоматическое обнаружение сущностей всех подключенных модулей.
  - `migrations`: `[__dirname + '/database/migrations/*{.ts,.js}']` — Регистрация миграций в приложении.
  - `migrationsTableName`: `'typeorm_migrations'` — Таблица истории миграций.
- **Подключенные модули:**
  - `HealthModule`
  - `UnitsModule`
  - `CategoriesModule`
  - `TagsModule`
  - `AttributesModule`
  - `PartsModule`
  - `ActorsModule`
  - `StockModule`
  - `McpModule`
  - `AdminModule`

---

## 3. Управление миграциями базы данных (TypeORM CLI)

### Архитектура и структура
- **CLI DataSource:** `src/database/data-source.ts`
  - Строгая изоляция: конфигурация подключения читается исключительно из файла `.env.production`. При отсутствии файла процесс прерывается с фатальной ошибкой.
  - Явный импорт всех 10 сущностей TypeORM (`Actor`, `Unit`, `Category`, `Tag`, `AttributeDefinition`, `AttributeOption`, `AttributeValueHistory`, `Part`, `AttributeValue`, `StockMovement`).
  - Конфигурация `synchronize: false`, путь к миграциям `src/database/migrations/*{.ts,.js}` и таблица версий `typeorm_migrations`.
- **Каталог миграций:** `src/database/migrations/`
- **Скрипты-хелперы:**
  - `src/database/scripts/generate-migration.ts`: кроссплатформенная генерация миграции в `src/database/migrations/` по имени.
  - `src/database/scripts/create-migration.ts`: создание шаблона пустой миграции в `src/database/migrations/`.

### Команды управления миграциями
| Команда | Описание |
| :--- | :--- |
| `pnpm run migration:generate <Name>` | Генерация миграции на основе сравнения сущностей и схемы БД в `src/database/migrations/` |
| `pnpm run migration:create <Name>` | Создание шаблона пустой миграции в `src/database/migrations/` |
| `pnpm run migration:show` | Просмотр списка миграций и статуса их выполнения |
| `pnpm run migration:run` | Применение всех ожидающих миграций к БД |
| `pnpm run migration:revert` | Откат последней примененной миграции |
| `pnpm run typeorm <args>` | Прямой запуск TypeORM CLI с подключением `src/database/data-source.ts` |
