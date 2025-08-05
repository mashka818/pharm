# 🔄 Интеграция QR-кодов ФНС с сетями аптек

## 📋 **Описание функциональности**

Система позволяет обрабатывать QR-коды чеков ФНС для начисления кешбека в зависимости от сети аптек. Каждая сеть имеет свой поддомен и индивидуальные условия кешбека.

## 🏗️ **Архитектура**

### **Пользовательский сценарий:**
1. Пользователь сканирует QR-код чека на поддомене сети (например, `р-фарм.чекпоинт.рф`)
2. Фронтенд отправляет QR-код + токен пользователя на бэкенд
3. Бэкенд извлекает ID пользователя и определяет сеть по поддомену
4. Бэкенд отправляет данные чека в ФНС для проверки
5. При валидном чеке начисляется кешбек согласно условиям сети

## 🔧 **Новые компоненты**

### **1. FnsQrController** (`src/fns/fns-qr.controller.ts`)
- Обрабатывает запросы на сканирование QR-кодов
- Извлекает поддомен из заголовка Host
- Валидирует токен пользователя
- Определяет сеть по поддомену

### **2. FnsQrParserService** (`src/fns/fns-qr-parser.service.ts`)
- Парсит QR-код в формате ФНС
- Извлекает обязательные параметры: fn, fd, fp, sum, date
- Преобразует дату в ISO формат

### **3. FnsNetworkService** (`src/fns/fns-network.service.ts`)
- Определяет сеть по поддомену
- Рассчитывает кешбек для конкретной сети
- Сопоставляет товары с предложениями сети

### **4. ScanQrDto** (`src/fns/dto/scan-qr.dto.ts`)
- DTO для запроса сканирования QR-кода
- Содержит QR-код и токен пользователя

## 📡 **API Endpoints**

### **POST /fns/qr/scan**
Сканирование QR-кода и обработка чека

**Заголовки:**
- `Host`: Поддомен сети (например, `р-фарм.чекпоинт.рф`)
- `Content-Type`: `application/json`

**Тело запроса:**
```json
{
  "qrCode": "t=20231201T1430&s=1234.56&fn=9287440300090728&i=12345&fp=1234567890&n=1",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "additionalData": {}
}
```

**Ответ:**
```json
{
  "requestId": "uuid",
  "status": "pending",
  "message": "Receipt verification started",
  "networkId": 1,
  "networkName": "Р-Фарм"
}
```

## 🗄️ **Обновления базы данных**

### **Новые поля в таблице `companies`:**
- `name` (VARCHAR) - Название сети
- `subdomain` (VARCHAR, UNIQUE) - Поддомен сети
- `role` (enum) - Добавлено значение `PHARMACY_NETWORK`

### **SQL для обновления:**
```sql
-- Добавление полей для сетей аптек
ALTER TABLE companies ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subdomain VARCHAR(255) UNIQUE;

-- Обновление enum CompanyRole
ALTER TYPE "CompanyRole" ADD VALUE IF NOT EXISTS 'PHARMACY_NETWORK';

-- Создание индексов
CREATE INDEX IF NOT EXISTS idx_companies_subdomain ON companies(subdomain);
CREATE INDEX IF NOT EXISTS idx_companies_role ON companies(role);
```

## 🔐 **Аутентификация и авторизация**

### **Токен пользователя:**
- Содержит ID пользователя и ID сети
- Валидируется при каждом запросе
- Проверяется соответствие сети в токене и поддомена

### **Поддомены:**
- Извлекаются из заголовка `Host`
- Формат: `{subdomain}.{domain}`
- Пример: `р-фарм.чекпоинт.рф`

## 💰 **Расчет кешбека**

### **Логика расчета:**
1. Определение сети по поддомену
2. Получение активных предложений для сети
3. Парсинг товаров из чека
4. Сопоставление товаров с предложениями
5. Расчет кешбека по условиям сети

### **Типы кешбека:**
- **Процентный**: `itemTotal * (profit / 100)`
- **Фиксированный**: `profit`

## 🚀 **Развертывание**

### **1. Обновление базы данных:**
```bash
# Применить SQL-миграцию
psql -d pharm_vision -f migration_add_network_subdomain.sql
```

### **2. Настройка переменных окружения:**
```env
DATABASE_URL="postgresql://postgres:010406@localhost:5432/pharm_vision"
FNS_APP_ID="2dbfa911-1931-48e7-802f-640dc64429b0"
FNS_AUTH_SERVICE_URL="https://openapi.nalog.ru:8090/open-api/AuthService/0.1"
FNS_ASYNC_SERVICE_URL="https://openapi.nalog.ru:8090/open-api/ais3/KktService/0.1"
JWT_SECRET="gpW7DtMraBcCf4rXXyMmLZ25cMsrjv6z"
```

### **3. Создание сетей аптек:**
```sql
INSERT INTO companies (username, password, name, subdomain, promotionId, role)
VALUES 
  ('r-pharm', 'hashed_password', 'Р-Фарм', 'р-фарм', 'promotion_id', 'PHARMACY_NETWORK'),
  ('apteka-36-6', 'hashed_password', 'Аптека 36.6', 'apteka-36-6', 'promotion_id', 'PHARMACY_NETWORK');
```

## 🧪 **Тестирование**

### **Пример запроса:**
```bash
curl -X POST http://localhost:4000/fns/qr/scan \
  -H "Host: р-фарм.чекпоинт.рф" \
  -H "Content-Type: application/json" \
  -d '{
    "qrCode": "t=20231201T1430&s=1234.56&fn=9287440300090728&i=12345&fp=1234567890&n=1",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

### **Ожидаемый ответ:**
```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "Receipt verification started",
  "networkId": 1,
  "networkName": "Р-Фарм"
}
```

## 📊 **Мониторинг**

### **Логи:**
- Все операции логируются с уровнем INFO
- Ошибки логируются с уровнем ERROR
- Включают ID пользователя, сети и запроса

### **Метрики:**
- Количество обработанных QR-кодов
- Успешность проверок ФНС
- Суммы начисленного кешбека по сетям

## 🔄 **Обработка ошибок**

### **Основные ошибки:**
- `400 Bad Request`: Неверный формат QR-кода или токена
- `401 Unauthorized`: Неверный токен пользователя
- `404 Not Found`: Сеть не найдена для поддомена

### **Логика повторных попыток:**
- Rate limiting: повтор через 10 секунд
- Ошибки сети: до 3 попыток
- Таймауты: 30 секунд на запрос

## 🎯 **Готовность к продакшену**

✅ **Реализовано:**
- Парсинг QR-кодов ФНС
- Определение сетей по поддоменам
- Расчет кешбека по сетям
- Интеграция с API ФНС
- Обработка ошибок и повторные попытки
- Логирование операций

🔄 **Следующие шаги:**
1. Настройка базы данных
2. Создание тестовых сетей аптек
3. Тестирование с реальными QR-кодами
4. Мониторинг производительности
5. Настройка алертов