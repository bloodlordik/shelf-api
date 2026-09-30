# Health Module Specification

Модуль `health` предоставляет механизмы мониторинга состояния сервиса (Health Check, Liveness и Readiness пробы) для оркестраторов (Kubernetes, Docker Compose) и внешних систем мониторинга.

## 1. Архитектура и компоненты

- **Контроллер:** `HealthController` (`src/health/health.controller.ts`)
  - Роут: `/health` (исключен из глобального префикса `/api` и версионирования).
- **Сервис:** `HealthService` (`src/health/health.service.ts`)
  - Выполняет сбор метрик времени работы (`uptime`), потребления памяти (`process.memoryUsage()`) и проверки связи с PostgreSQL.

---

## 2. Эндпоинты API

### `GET /health`
Полный отчет о состоянии приложения и всех зависимостей.

- **HTTP Ответы:**
  - `200 OK` — Все сервисы и база данных доступны (`status: "ok"`).
  - `503 Service Unavailable` — Как минимум одна критическая зависимость недоступна (`status: "error"`).
- **Схема ответа (`HealthResponseDto`):**
```json
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up",
      "responseTime": 2
    },
    "memory": {
      "status": "up",
      "rss": 84561920,
      "heapTotal": 45123992,
      "heapUsed": 38129384,
      "external": 2489102
    }
  },
  "error": {},
  "details": {
    "database": {
      "status": "up",
      "responseTime": 2
    },
    "memory": {
      "status": "up",
      "rss": 84561920,
      "heapTotal": 45123992,
      "heapUsed": 38129384,
      "external": 2489102
    }
  }
}
```

### `GET /health/live`
Liveness проба: проверка того, что Node.js процесс жив и обрабатывает HTTP-запросы.

- **HTTP Ответ:** `200 OK`
- **Схема ответа (`LivenessResponseDto`):**
```json
{
  "status": "ok",
  "timestamp": "2026-09-30T10:00:00.000Z",
  "uptime": 124.5
}
```

### `GET /health/ready`
Readiness проба: проверка готовности сервиса принимать входящий трафик (проверяет доступность PostgreSQL быстрым запросом `SELECT 1`).

- **HTTP Ответы:**
  - `200 OK` — База данных отвечает, сервис готов к трафику.
  - `503 Service Unavailable` — База данных недоступна.
- **Схема ответа (`ReadinessResponseDto`):**
```json
{
  "status": "ok",
  "timestamp": "2026-09-30T10:00:00.000Z",
  "checks": {
    "database": "up"
  }
}
```
