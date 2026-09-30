# Actors Module Specification

Модуль `actors` управляет локальным реестром внешних пользователей, операторов и системных сервисов (акторов), совершающих операции в складской системе (создание деталей, проведение складских движений, изменение атрибутов).

## 1. Назначение и концепция
Идентификаторы пользователей приходят из внешней системы аутентификации в виде целочисленного `ID` (`number` / `integer`).
Модуль обеспечивает:
1. Автоматическую регистрацию актора в локальной таблице `actors` при его первом действии без необходимости предварительного создания.
2. Фиксацию времени первого появления (`created_at`) и обновления времени последней активности (`last_seen_at`).
3. Поддержание целостности внешних ключей (`FK`) для таблиц аудита (`stock_movements`, `attribute_value_history`).

---

## 2. Схема базы данных (Entity)

### `Actor` (`src/modules/actors/entities/actor.entity.ts`)
- **Таблица:** `actors`
- **Поля:**
  - `id: number` — Внешний целочисленный идентификатор пользователя/сервиса (`integer`, Primary Key).
  - `createdAt: Date` — Время первой фиксации актора в системе (`timestamptz`, колонка `created_at`, default `CURRENT_TIMESTAMP`).
  - `lastSeenAt: Date` — Время последней зафиксированной активности актора (`timestamptz`, колонка `last_seen_at`, default `CURRENT_TIMESTAMP`).

---

## 3. Сервисы и внутренняя спецификация

### `ActorsService` (`src/modules/actors/services/actors.service.ts`)

#### `ensureActorExists(actorId: number, manager?: EntityManager): Promise<Actor>`
Гарантирует существование актора в базе данных. Выполняет атомарный PostgreSQL UPSERT:
```sql
INSERT INTO actors (id, created_at, last_seen_at)
VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP;
```
- **Параметры:**
  - `actorId: number` — Целочисленный идентификатор актора.
  - `manager?: EntityManager` — Опциональный транзакционный менеджер (для участия в общей транзакции).
- **Возвращает:** Сущность `Actor`.

#### `findOne(id: number, manager?: EntityManager): Promise<Actor | null>`
Поиск актора по ID.

---

## 4. Требования к данным
- `actorId` должен быть корректным неотрицательным целым числом (`INT`).
- Модуль не экспортирует публичных HTTP-контроллеров — он используется другими модулями (`stock`, `attributes`, `parts`) через сервисную инъекцию.
