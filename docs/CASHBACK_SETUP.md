# Инструкция по настройке системы кэшбека

## Обзор изменений

Система кэшбека была полностью переработана для обеспечения более точного расчета, детализированной истории и возможности административного управления.

### Основные улучшения:

1. **Новая структура БД** - отдельные таблицы для истории кэшбека
2. **Улучшенный алгоритм сопоставления** товаров из чека с товарами в базе
3. **Детализированная история** с возможностью отмены начислений
4. **Административная панель** для управления кэшбеком
5. **Интеграция с ФНС** - автоматическое начисление после валидации чека

## Новые таблицы БД

### cashbacks
```sql
CREATE TABLE cashbacks (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  receipt_id INTEGER REFERENCES receipts(id),
  fns_request_id TEXT REFERENCES fns_requests(id),
  promotion_id TEXT NOT NULL REFERENCES promotions(promotion_id),
  amount INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  reason TEXT,
  cancelled_by INTEGER REFERENCES admins(id),
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### cashback_items
```sql
CREATE TABLE cashback_items (
  id SERIAL PRIMARY KEY,
  cashback_id INTEGER NOT NULL REFERENCES cashbacks(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  offer_id INTEGER REFERENCES offers(id),
  product_name TEXT NOT NULL,
  product_sku TEXT,
  quantity INTEGER NOT NULL,
  item_price INTEGER NOT NULL,
  total_price INTEGER NOT NULL,
  cashback_amount INTEGER NOT NULL,
  cashback_type VARCHAR(20) NOT NULL,
  cashback_rate INTEGER
);
```

## Установка и настройка

### 1. Обновление схемы БД

```bash
# Применить миграции Prisma
npx prisma migrate deploy

# Или создать новую миграцию (для разработки)
npx prisma migrate dev --name "add-cashback-system"
```

### 2. Генерация клиента Prisma

```bash
npx prisma generate
```

### 3. Установка зависимостей

Все необходимые зависимости уже включены в проект:
- `@nestjs/common`, `@nestjs/core` - основа NestJS
- `@prisma/client` - ORM для работы с БД
- `class-validator`, `class-transformer` - валидация
- `@nestjs/swagger` - документация API

### 4. Настройка переменных окружения

Убедитесь, что в `.env` файле настроены:

```env
# База данных
DATABASE_URL="postgresql://user:password@localhost:5432/pharm_vision"

# ФНС API (уже настроено)
FTX_API_URL="https://openapi.nalog.ru:8090"
FTX_TOKEN="your_fns_token"
FNS_DEV_MODE=true
```

## Конфигурация

### Настройка акций для кэшбека

1. **Создание товаров с фиксированным кэшбеком:**
```sql
UPDATE products 
SET fix_cashback = 500, cashback_type = 'amount' 
WHERE sku = 'PRODUCT_SKU';

UPDATE products 
SET fix_cashback = 5, cashback_type = 'percent' 
WHERE category = 'vitamins';
```

2. **Создание акций с кэшбеком:**
```sql
INSERT INTO offers (profit, profit_type, date_from, date_to, promotion_id) 
VALUES (10, 'from', '2024-01-01', '2024-12-31', 'your_promotion_id');

-- Связывание товаров с акцией
INSERT INTO product_offers (product_id, offer_id) 
VALUES (product_id, offer_id);
```

3. **Настройка условий акций:**
```sql
INSERT INTO offer_conditions (variant, type, from_value, to_value) 
VALUES ('amount', 'from', 2, NULL); -- Минимум 2 товара

UPDATE offers SET condition_id = condition_id WHERE id = offer_id;
```

## API Endpoints

### Для администраторов

- `GET /cashback/history/today` - история кэшбека за день
- `GET /cashback/stats/today` - статистика кэшбека
- `PUT /cashback/{id}/cancel` - отмена кэшбека
- `GET /cashback/{id}` - детали кэшбека

### Интеграция с ФНС

- `POST /fns/scan-qr` - автоматически использует новую систему кэшбека

## Тестирование

### Запуск unit тестов

```bash
npm test src/cashback/cashback.service.spec.ts
```

### Запуск всех тестов

```bash
npm test
```

### Тестирование API

1. **Запуск сервера:**
```bash
npm run start:dev
```

2. **Открытие Swagger UI:**
```
http://localhost:4000/api
```

3. **Тестовый сценарий:**
   - Авторизоваться как администратор
   - Сканировать тестовый QR код через `/fns/scan-qr`
   - Проверить начисление в `/cashback/history/today`
   - Протестировать отмену через `/cashback/{id}/cancel`

## Мониторинг и логирование

### Логи системы кэшбека

Система ведет подробные логи всех операций:

```typescript
// Включить детальное логирование
logger.setContext('CashbackService');
logger.log('Cashback calculation started');
logger.error('Cashback error:', error);
```

### Мониторинг производительности

```bash
# Мониторинг БД запросов
tail -f logs/database.log | grep "cashback"

# Мониторинг API запросов
tail -f logs/api.log | grep "cashback"
```

## Резервное копирование

### Бэкап данных кэшбека

```sql
-- Экспорт истории кэшбека
COPY (
  SELECT c.*, ci.* 
  FROM cashbacks c 
  LEFT JOIN cashback_items ci ON c.id = ci.cashback_id
  WHERE c.created_at >= '2024-01-01'
) TO '/backup/cashback_history.csv' WITH CSV HEADER;
```

### Восстановление

```sql
-- Импорт из резервной копии
COPY cashbacks FROM '/backup/cashbacks.csv' WITH CSV HEADER;
COPY cashback_items FROM '/backup/cashback_items.csv' WITH CSV HEADER;
```

## Производительность

### Оптимизация БД

```sql
-- Индексы для быстрого поиска
CREATE INDEX idx_cashbacks_customer_date ON cashbacks(customer_id, created_at);
CREATE INDEX idx_cashbacks_promotion_date ON cashbacks(promotion_id, created_at);
CREATE INDEX idx_cashback_items_product ON cashback_items(product_id);
CREATE INDEX idx_cashback_items_offer ON cashback_items(offer_id);

-- Анализ производительности
EXPLAIN ANALYZE SELECT * FROM cashbacks WHERE created_at >= '2024-01-01';
```

### Кэширование

```typescript
// Кэширование активных акций
@Cacheable('active-offers', 300) // 5 минут
async getActiveOffers(promotionId: string) {
  // Implementation
}
```

## Миграция данных

### Перенос из старой системы

```sql
-- Миграция существующих данных
INSERT INTO cashbacks (customer_id, fns_request_id, promotion_id, amount, created_at)
SELECT 
  customer_id, 
  id as fns_request_id, 
  promotion_id, 
  cashback_amount, 
  created_at
FROM fns_requests 
WHERE cashback_awarded = true;
```

## Troubleshooting

### Частые проблемы

1. **Кэшбек не начисляется:**
   - Проверить активные акции: `SELECT * FROM offers WHERE date_from <= NOW() AND date_to >= NOW()`
   - Проверить связи товаров: `SELECT * FROM product_offers WHERE product_id = ?`
   - Проверить лимиты клиента

2. **Ошибки при отмене кэшбека:**
   - Проверить баланс бонусов клиента
   - Проверить статус кэшбека (не отменен ли уже)
   - Проверить права администратора

3. **Медленная работа:**
   - Проверить индексы БД
   - Оптимизировать запросы
   - Включить кэширование

### Логи для диагностики

```bash
# Поиск ошибок кэшбека
grep -n "Error.*cashback" logs/application.log

# Анализ производительности
grep -n "Calculating cashback" logs/application.log | tail -10
```

## Безопасность

### Валидация входных данных

- Все DTO используют `class-validator`
- Проверка прав доступа на уровне контроллера
- Валидация бизнес-логики в сервисе

### Аудит операций

- Все операции отмены логируются
- Сохранение информации об администраторе
- Ведение истории изменений

## Расширение функциональности

### Добавление новых типов кэшбека

1. Обновить enum в Prisma:
```prisma
enum CashbackType {
  percent
  amount
  points  // новый тип
}
```

2. Реализовать логику в сервисе:
```typescript
private calculateItemCashback(item: ReceiptItem, offer: any): number {
  switch (offer.cashbackType) {
    case 'points':
      return this.calculatePointsCashback(item, offer);
    // ...
  }
}
```

### Интеграция с внешними системами

```typescript
// Добавление webhook уведомлений
async notifyExternalSystem(cashback: Cashback) {
  await this.httpService.post('/webhook/cashback', {
    event: 'cashback.awarded',
    data: cashback
  });
}
```

## Поддержка

При возникновении проблем:

1. Проверить логи приложения
2. Проверить состояние БД
3. Использовать Swagger UI для тестирования API
4. Обратиться к документации в `docs/CASHBACK_API.md`