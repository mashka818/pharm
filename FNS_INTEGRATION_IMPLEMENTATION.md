# Интеграция с API ФНС для сканирования QR-кодов чеков

## Обзор

Реализована интеграция с API ФНС для проверки чеков по QR-кодам с поддержкой мультитенантной архитектуры (отдельные сети аптек).

## Ключевые изменения

### 1. Обновление схемы БД

- Добавлена поддержка мультитенантности в модель `Promotion`
- Обновлена модель `FnsRequest` с привязкой к промоакции
- Добавлены поля `domain`, `inn`, `ogrn`, `appId` в промоакции
- Обеспечена изоляция данных между сетями

### 2. Новые API endpoints

#### `POST /receipt/scan-qr`
Основной endpoint для сканирования QR-кодов чеков.

**Заголовки:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Пример запроса:**
```json
{
  "fn": "9287440300090728",
  "fd": "77133", 
  "fp": "1482926127",
  "sum": 240000,
  "date": "2019-04-09T16:38:00",
  "typeOperation": 1
}
```

**Пример ответа:**
```json
{
  "requestId": "uuid-generated",
  "status": "pending",
  "message": "Receipt verification started",
  "network": "Р-Фарм"
}
```

### 3. Пользовательский сценарий

1. **Авторизация пользователя**
   ```bash
   POST /auth/login/customer-v2
   {
     "email": "user@example.com",
     "password": "password123",
     "promotionId": "r-farm-network"
   }
   ```

2. **Сканирование QR-кода**
   ```bash
   POST /receipt/scan-qr
   Authorization: Bearer <token>
   Host: р-фарм.чекпоинт.рф
   
   {
     "fn": "9287440300090728",
     "fd": "77133",
     "fp": "1482926127", 
     "sum": 240000,
     "date": "2019-04-09T16:38:00"
   }
   ```

3. **Проверка статуса**
   ```bash
   GET /receipt/status/{requestId}
   ```

### 4. Архитектурные компоненты

#### FnsService
- `processScanQrCode()` - основной метод обработки QR-кодов
- Проверка лимитов по сети
- Валидация домена
- Изоляция кешбека по сетям

#### FnsAuthService  
- Получение временных токенов от ФНС
- Кеширование токенов
- Обработка SOAP запросов аутентификации

#### FnsCheckService
- Отправка чеков в ФНС через SOAP API
- Получение результатов проверки
- Асинхронная обработка

#### TenantMiddleware
- Определение сети по домену
- Автоматическое извлечение `promotionId`

### 5. Конфигурация

Необходимые переменные окружения:

```env
# FNS API Configuration
FNS_API_URL="https://openapi.nalog.ru:8090"
FNS_AUTH_SERVICE_URL="https://openapi.nalog.ru:8090/open-api/AuthService/0.1"
FNS_ASYNC_SERVICE_URL="https://openapi.nalog.ru:8090/open-api/ais3/KktService/0.1"
FNS_APP_ID="2dbfa911-1931-48e7-802f-640dc64429b0"
FNS_MASTER_TOKEN="YOUR_MASTER_TOKEN_HERE"
```

### 6. Мультитенантность

#### Создание промоакции
```sql
INSERT INTO promotions (
  "promotionId", 
  name, 
  logo, 
  favicon, 
  color, 
  description,
  domain,
  inn,
  ogrn,
  "appId"
) VALUES (
  'r-farm-network',
  'Р-Фарм',
  '/logos/r-farm.png',
  '/favicons/r-farm.ico', 
  '#007bff',
  'Сеть аптек Р-Фарм',
  'р-фарм.чекпоинт.рф',
  '5032364514',
  '1234567890123',
  '2dbfa911-1931-48e7-802f-640dc64429b0'
);
```

#### Изоляция данных
- Каждая сеть имеет собственную базу пользователей
- Кешбек начисляется только в рамках сети
- Лимиты проверяются по сети
- Спецпредложения изолированы по сетям

### 7. Безопасность и лимиты

- **Дневной лимит запросов**: 1000 в день на сеть
- **Лимит кешбека**: 10 чеков в день на пользователя в сети
- **Валидация домена**: проверка соответствия домена сети
- **Дедупликация**: защита от повторного начисления кешбека

### 8. Мониторинг

#### Статистика очереди
```bash
GET /receipt/stats/queue
```

#### Дневной счетчик
```bash  
GET /receipt/stats/daily-count
```

#### История кешбека
```bash
GET /receipt/history/cashback
```

### 9. Обработка ошибок

#### Типы ошибок:
- `invalid_domain` - неверный домен для сети
- `cashback_already_received` - кешбек уже получен
- `daily_limit_exceeded` - превышен дневной лимит
- `authentication_failed` - ошибка аутентификации в ФНС
- `invalid_receipt` - невалидный чек

#### Пример ошибки:
```json
{
  "requestId": null,
  "status": "rejected", 
  "message": "Cashback already received for this receipt in this network"
}
```

### 10. Развертывание

1. Обновить переменные окружения
2. Запустить миграции БД
3. Создать промоакции
4. Настроить DNS для поддоменов
5. Добавить SSL сертификаты

### 11. Тестирование

#### Тестовые данные
```json
{
  "fn": "9287440300090728",
  "fd": "77133",
  "fp": "1482926127",
  "sum": 240000,
  "date": "2019-04-09T16:38:00",
  "typeOperation": 1
}
```

Эта интеграция обеспечивает полную функциональность сканирования QR-кодов чеков с изоляцией по сетям аптек согласно требованиям.