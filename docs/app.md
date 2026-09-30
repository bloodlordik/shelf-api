# Application Core & Bootstrap Specification

Документ описывает глобальную архитектуру, точку входа (`src/main.ts`), корневой модуль (`src/app.module.ts`), безопасность, глобальные пайпы, фильтры и интеграцию с базой данных.

## 1. Точка входа (`src/main.ts`)

### Конфигурация и запуск приложения
1. **Безопасность (Helmet):**
   - Настроена Content Security Policy (CSP) для безопасной работы Swagger UI (`validator.swagger.io`, `unsafe-inline`, `data:`).
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
