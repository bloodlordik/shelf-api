# Admin Module Specification

Модуль `admin` предоставляет сводные аналитические данные и агрегированные метрики для административной панели и главного дашборда склада.

## 1. Архитектура и маршрутизация

- **Контроллер:** `AdminController` (`src/modules/admin/admin.controller.ts`)
  - Базовый путь: `/admin` (нейтральная версия `VERSION_NEUTRAL`, исключён из глобального префикса `/api`).
- **Сервис:** `AdminService` (`src/modules/admin/admin.service.ts`)
  - Агрегирует данные параллельными запросами ко всем подсистемам приложения.

---

## 2. Агрегация данных дашборда

Метод `getStats()` параллельно через `Promise.all` запрашивает:
1. **Сводку по каталогу деталей (`PartsService.getSummary`):**
   - Общее количество номенклатурных позиций (`totalParts`).
   - Суммарное количество физических единиц на складе (`totalQuantity`).
   - Количество позиций с низким остатком $\le 5$ (`lowStockCount`).
   - Количество позиций с нулевым остатком $= 0$ (`outOfStockCount`).
2. **Счётчики справочников:**
   - Количество категорий (`categoriesCount`).
   - Количество тегов (`tagsCount`).
   - Количество определений характеристик (`attributesCount`).
   - Количество единиц измерения (`unitsCount`).
3. **Складские движения:**
   - Общее количество зафиксированных складских операций (`movementsCount`).
   - Список последних 10 движений (`recentMovements: StockMovementResponseDto[]`).
4. **Критические остатки:**
   - Топ-10 позиций с минимальным остатком (`lowStockParts: LowStockPartSummaryDto[]`), отсортированных по возрастанию количества (`quantity ASC`).

---

## 3. REST API Эндпоинты

### `GET /admin/stats`
Получение полной агрегированной статистики для дашборда.

- **HTTP Ответ:** `200 OK`
- **Схема ответа (`AdminStatsResponseDto`):**
```json
{
  "totalParts": 1240,
  "totalQuantity": 54200,
  "lowStockCount": 8,
  "outOfStockCount": 2,
  "categoriesCount": 35,
  "tagsCount": 18,
  "attributesCount": 24,
  "unitsCount": 15,
  "movementsCount": 342,
  "recentMovements": [
    {
      "id": "7b8f9e10-1234-4567-89ab-cdef01234567",
      "partId": "9c8f9e10-1234-4567-89ab-cdef01234888",
      "movementType": "receipt",
      "quantityDelta": 100,
      "quantityAfter": 250,
      "reason": "Поступление от поставщика",
      "referenceDoc": "ТТН-1024",
      "performedBy": 42,
      "performedAt": "2026-09-30T09:30:00.000Z"
    }
  ],
  "lowStockParts": [
    {
      "id": "9c8f9e10-1234-4567-89ab-cdef01234888",
      "sku": "CAP-0603-100NF",
      "name": "Конденсатор 100нФ 0603",
      "quantity": 2,
      "categoryName": "Конденсаторы SMD"
    }
  ]
}
```
