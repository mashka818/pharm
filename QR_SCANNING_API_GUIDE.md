# Руководство по API сканирования QR-кодов чеков

## Обзор

API предоставляет возможность сканирования QR-кодов с чеков и начисления кешбека в рамках различных сетей аптек.

## Базовый URL

```
https://чек-поинт.рф/api
```

## Аутентификация

Все запросы к API сканирования должны содержать JWT токен в заголовке Authorization.

### Получение токена

```http
POST /auth/login/customer-v2
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "promotionId": "r-farm-network"
}
```

**Ответ:**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Основные endpoints

### 1. Сканирование QR-кода чека

```http
POST /receipt/scan-qr
Authorization: Bearer {access_token}
Content-Type: application/json
Host: р-фарм.чекпоинт.рф

{
  "fn": "9287440300090728",
  "fd": "77133",
  "fp": "1482926127",
  "sum": 240000,
  "date": "2019-04-09T16:38:00",
  "typeOperation": 1
}
```

**Параметры:**
- `fn` (string) - Фискальный номер (16 символов)
- `fd` (string) - Фискальный документ
- `fp` (string) - Фискальный признак  
- `sum` (number) - Сумма чека в копейках
- `date` (string) - Дата и время в формате ISO
- `typeOperation` (number, optional) - Тип операции (1 - приход, 2 - возврат)

**Успешный ответ:**
```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "Receipt verification started",
  "network": "Р-Фарм"
}
```

**Ошибки:**
```json
{
  "requestId": null,
  "status": "rejected",
  "message": "Cashback already received for this receipt in this network"
}
```

### 2. Проверка статуса обработки

```http
GET /receipt/status/{requestId}
Authorization: Bearer {access_token}
```

**Ответ:**
```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "success",
  "cashbackAmount": 240,
  "cashbackAwarded": true,
  "isValid": true,
  "isReturn": false,
  "isFake": false,
  "createdAt": "2024-01-09T16:38:00.000Z",
  "updatedAt": "2024-01-09T16:38:30.000Z",
  "customer": {
    "id": 123,
    "name": "Иван",
    "email": "user@example.com"
  }
}
```

### 3. История кешбека

```http
GET /receipt/history/cashback
Authorization: Bearer {access_token}
```

**Ответ:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "cashbackAmount": 240,
    "createdAt": "2024-01-09T16:38:00.000Z",
    "qrData": {
      "fn": "9287440300090728",
      "fd": "77133",
      "fp": "1482926127",
      "sum": 240000
    }
  }
]
```

## Статусы обработки

- `pending` - Запрос в очереди на обработку
- `processing` - Запрос обрабатывается
- `success` - Чек валиден, кешбек начислен
- `rejected` - Чек отклонен (уже обработан/невалиден)
- `failed` - Ошибка обработки

## Мультитенантность

Каждая сеть аптек имеет свой поддомен:

- `р-фарм.чекпоинт.рф` - сеть Р-Фарм
- `36-6.чекпоинт.рф` - сеть 36.6
- `rigla.чекпоинт.рф` - сеть Ригла

Пользователи регистрируются отдельно в каждой сети и получают кешбек только в рамках своей сети.

## Лимиты и ограничения

- **Дневной лимит запросов**: 1000 на сеть
- **Лимит кешбека**: 10 чеков в день на пользователя в сети  
- **Дедупликация**: Один чек = один кешбек в сети
- **Валидация домена**: Запросы проверяются на соответствие домену сети

## Примеры ошибок

### Превышен дневной лимит
```json
{
  "requestId": null,
  "status": "rejected", 
  "message": "Daily request limit exceeded for this network"
}
```

### Неверный домен
```json
{
  "statusCode": 400,
  "message": "Invalid domain for this promotion"
}
```

### Кешбек уже получен
```json
{
  "requestId": null,
  "status": "rejected",
  "message": "Cashback already received for this receipt in this network"
}
```

## Пример полного сценария

### 1. Авторизация
```bash
curl -X POST https://р-фарм.чекпоинт.рф/api/auth/login/customer-v2 \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ivan@example.com",
    "password": "password123", 
    "promotionId": "r-farm-network"
  }'
```

### 2. Сканирование QR-кода
```bash
curl -X POST https://р-фарм.чекпоинт.рф/api/receipt/scan-qr \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "fn": "9287440300090728",
    "fd": "77133", 
    "fp": "1482926127",
    "sum": 240000,
    "date": "2019-04-09T16:38:00"
  }'
```

### 3. Проверка статуса
```bash
curl -X GET https://р-фарм.чекпоинт.рф/api/receipt/status/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 4. Просмотр истории
```bash
curl -X GET https://р-фарм.чекпоинт.рф/api/receipt/history/cashback \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Тестовые данные

Для тестирования API можно использовать следующие данные чека:

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

Эти данные взяты из документации ФНС и подходят для отладки интеграции.