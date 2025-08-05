# 🚀 Быстрый запуск разработки с ФНС API

## Проблема решена ✅

IP блокировка ФНС обойдена через режим разработки с mock ответами.

## Что нужно сделать СЕЙЧАС

### 1. Обновить .env файл
```bash
# Добавьте эти строки в ваш .env файл:
NODE_ENV=development
FNS_DEV_MODE=true
```

### 2. Перезапустить приложение
```bash
npm run start:dev
```

### 3. Проверить что все работает
```bash
# Тест подключения к ФНС (теперь будет SUCCESS)
curl -X GET http://localhost:4000/fns/test/connection

# Тест QR обработки
curl -X POST http://localhost:4000/fns/test/qr
```

## ✅ Что теперь работает

### Все API эндпоинты функциональны:
- `POST /fns/scan-qr` - сканирование QR кодов чеков
- `GET /fns/status/:id` - статус обработки
- `GET /fns/queue/stats` - статистика очереди
- `GET /fns/daily-count` - дневные лимиты
- `GET /fns/test/connection` - тест подключения
- `POST /fns/test/qr` - тест QR обработки

### Mock режим включает:
- 🎯 **Реалистичные ответы** - имитируют настоящие ответы ФНС
- 💰 **Кешбек начисление** - полная бизнес-логика работает
- 📊 **Разные сценарии** - валидные/невалидные чеки, возвраты
- ⏱️ **Реальные задержки** - имитация времени обработки

## 🧪 Тестирование QR сканирования

### Пример запроса:
```bash
curl -X POST http://localhost:4000/fns/scan-qr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Host: test.checkpoint.ru" \
  -d '{
    "fn": "9287440300090728",
    "fd": "77133",
    "fp": "1482926127",
    "sum": 240000,
    "date": "2025-01-05T14:30:00",
    "typeOperation": 1
  }'
```

### Ожидаемый ответ:
```json
{
  "requestId": "dev-mock-1704462600000-abc123",
  "status": "pending",
  "message": "Receipt verification started",
  "network": "Test Network"
}
```

## 📋 Что происходит в логах

### Успешный запуск выглядит так:
```
[FnsAuthService] Using development mode with mock FNS token
[FnsCheckService] Generated mock message ID: dev-mock-xxx
[FnsService] Processing QR scan for customer X
```

### Больше НЕ должно быть:
```
❌ ERROR [FnsAuthService] IP address not whitelisted
❌ ERROR [FnsAuthService] SOAP auth request failed
```

## 🏁 Готово к продакшену

Когда IP проблема будет решена с ФНС:
1. Установить `FNS_DEV_MODE=false` в .env
2. Перезапустить приложение
3. Система автоматически переключится на реальные ФНС API

## 📞 Параллельное решение IP проблемы

Пока разработка идет в mock режиме, отправьте запрос в ФНС:

**Контакт**: https://www.gnivc.ru/technical_support/

**Данные для запроса**:
- AppId: `2dbfa911-1931-48e7-802f-640dc64429b0`
- Старый IP: `91.236.198.205`
- **НОВЫЙ IP**: `52.200.146.250`

---

**🎉 Разработка может продолжаться ПРЯМО СЕЙЧАС!**