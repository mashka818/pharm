# 🚀 Руководство по тестированию FNS на продакшн сервере

Это руководство описывает, как запускать автоматизированные тесты FNS эндпоинтов на продакшн сервере `91.236.198.205:4020`.

## 📋 Быстрый старт

### Способ 1: Использование shell скрипта (рекомендуется)
```bash
# Переходим в папку с тестами
cd tests

# Запускаем все тесты на продакшн сервере
./run-tests-production.sh

# Запускаем тесты конкретного эндпоинта
./run-tests-production.sh scanQr
./run-tests-production.sh verify
./run-tests-production.sh status
./run-tests-production.sh queueStats
./run-tests-production.sh dailyCount
```

### Способ 2: Ручная установка переменных окружения
```bash
# Устанавливаем переменные окружения
export PROD_SERVER_IP=91.236.198.205
export PORT=4020
export JWT_SECRET=gpW7DtMraBcCf4rXXyMmLZ25cMsrjv6z
export DATABASE_URL="postgresql://pharm_vision:pharm_vision_password@localhost:5432/pharm_vision_db_test?schema=public"
export FTX_API_URL="https://openapi.nalog.ru:8090"
export FTX_TOKEN="LFgDIA4yBZjW6h174iwVDcRoDHhjmpuFLtAX3kHPT9ctgggajk36aLJIzIcs2kZyKvTqLy4rSEHi7KOgY0fuNHKPbGCekDg9qjpin04K4ZyfolqtwDBZ6f6Isja3MMWe"

# Запускаем тесты
node run-all-new-fns-tests.js
```

### Способ 3: Использование .env файла
```bash
# Копируем конфигурацию
cp .env.test .env

# Запускаем тесты
node run-all-new-fns-tests.js
```

## 🔧 Конфигурация

### Основные переменные окружения
```bash
# Сервер
PROD_SERVER_IP=91.236.198.205                    # IP продакшн сервера
PORT=4020                                         # Порт сервера
BACKEND_URL=http://91.236.198.205:4020           # Полный URL (автоматически)

# Авторизация
JWT_SECRET=gpW7DtMraBcCf4rXXyMmLZ25cMsrjv6z     # Секрет для JWT токенов

# База данных
DATABASE_URL=postgresql://pharm_vision:pharm_vision_password@localhost:5432/pharm_vision_db_test?schema=public

# FNS API
FTX_API_URL=https://openapi.nalog.ru:8090         # URL FNS API
FTX_TOKEN=LFgDIA4yBZjW6h174iwVDcRoDHhjmpuFLtAX3kHPT9ctgggajk36aLJIzIcs2kZyKvTqLy4rSEHi7KOgY0fuNHKPbGCekDg9qjpin04K4ZyfolqtwDBZ6f6Isja3MMWe

# Дополнительные настройки
ROOT_ADMIN_USERNAME=admin
ROOT_ADMIN_PASSWORD=admin
FRONTEND_URL=https://pharm-vision.vercel.app/
YANDEX_ADDRESS=Anashkin.met@yandex.ru
YANDEX_PASS=knlqilweektnzxub
SALT=10
```

## 🧪 Тестируемые эндпоинты

| Метод | Эндпоинт | Описание | Тестовый файл |
|-------|----------|----------|---------------|
| POST | `/fns/scan-qr` | Сканирование QR кода для сетей аптек | `fns-scan-qr.test.js` |
| POST | `/fns/verify` | Проверка чека (legacy метод) | `fns-verify.test.js` |
| GET | `/fns/status/:requestId` | Статус обработки запроса | `fns-status.test.js` |
| GET | `/fns/queue/stats` | Статистика очереди обработки | `fns-queue-stats.test.js` |
| GET | `/fns/daily-count` | Количество запросов за день | `fns-daily-count.test.js` |

## 📊 Интерпретация результатов

### Успешный запуск
```
🚀 === Запуск всех тестов FNS эндпоинтов ===

📋 Тестируемые эндпоинты:
  • POST /fns/scan-qr - Сканирование QR кода
  • POST /fns/verify - Проверка чека (legacy)
  • GET /fns/status/:requestId - Статус запроса
  • GET /fns/queue/stats - Статистика очереди
  • GET /fns/daily-count - Количество запросов за день

============================================================

🎯 Запуск тестов для: SCANQR
────────────────────────────────────────

✅ === Тест успешного сканирования QR кода ===
Endpoint: http://91.236.198.205:4020/fns/scan-qr
📊 Статус ответа: 200
✅ УСПЕХ: QR код обработан корректно

...

📊 === ОБЩАЯ СВОДКА ТЕСТИРОВАНИЯ FNS ЭНДПОИНТОВ ===

📋 Результаты по эндпоинтам:
  ✅ scanQr       | 6/6 (100.0%)         | completed
  ✅ verify       | 7/7 (100.0%)         | completed
  ✅ status       | 6/6 (100.0%)         | completed
  ✅ queueStats   | 6/6 (100.0%)         | completed
  ✅ dailyCount   | 7/7 (100.0%)         | completed

📊 Общая статистика:
  🎯 Эндпоинтов протестировано: 5
  ✅ Эндпоинтов прошли все тесты: 5
  📈 Общий процент успеха: 100.0%
  🧪 Всего тестов выполнено: 32/32
  ⏱️ Общее время выполнения: 15.42 секунд

🎉 ВСЕ ЭНДПОИНТЫ ПРОШЛИ ТЕСТИРОВАНИЕ УСПЕШНО!
```

### Типичные ошибки и решения

#### 🔴 Ошибка подключения
```
❌ HTTP Error connect ECONNREFUSED 91.236.198.205:4020
```
**Решение**: 
- Проверьте доступность сервера: `ping 91.236.198.205`
- Убедитесь, что сервер запущен на порту 4020
- Проверьте файрвол и сетевые настройки

#### 🔴 Ошибка авторизации
```
❌ HTTP Error 401: Unauthorized
```
**Решение**:
- Проверьте JWT_SECRET в переменных окружения
- Убедитесь, что секрет соответствует серверной конфигурации

#### 🔴 Ошибка 404
```
❌ HTTP Error 404: Not Found
```
**Решение**:
- Убедитесь, что эндпоинт существует
- Проверьте версию API и роутинг

## 🔍 Диагностика

### Проверка доступности сервера
```bash
# Простая проверка пинга
ping 91.236.198.205

# Проверка порта
telnet 91.236.198.205 4020

# Проверка HTTP endpoint (если есть health check)
curl -v http://91.236.198.205:4020/health
```

### Проверка переменных окружения
```bash
# Показать текущие переменные
echo "PROD_SERVER_IP: $PROD_SERVER_IP"
echo "PORT: $PORT"
echo "JWT_SECRET: ${JWT_SECRET:0:10}..."
echo "DATABASE_URL: ${DATABASE_URL:0:30}..."
```

### Отладочный режим
```bash
# Запуск одного теста для отладки
node fns-scan-qr.test.js

# Запуск с дополнительными логами
DEBUG=* node run-all-new-fns-tests.js scanQr
```

## 📝 Логирование

Все тесты создают подробные логи включающие:
- 📤 Данные отправляемых запросов
- 📥 Полученные ответы от сервера
- 🔍 Результаты валидации
- ⏱️ Времена выполнения
- 📊 Статистику успешности

## 🛡️ Безопасность

- Тесты используют временные JWT токены для авторизации
- Секретные данные берутся из переменных окружения
- FNS токены используются только для реальных запросов к API
- Тестовые данные не содержат реальной конфиденциальной информации

## 🔄 CI/CD интеграция

### GitHub Actions пример
```yaml
name: FNS Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm install
      - run: npm install jsonwebtoken
      - name: Run FNS tests
        env:
          PROD_SERVER_IP: 91.236.198.205
          PORT: 4020
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
          FTX_TOKEN: ${{ secrets.FTX_TOKEN }}
        run: cd tests && ./run-tests-production.sh
```

## 📞 Поддержка

При проблемах с тестами проверьте:
1. Доступность продакшн сервера `91.236.198.205:4020`
2. Корректность переменных окружения
3. Актуальность JWT_SECRET и FTX_TOKEN
4. Логи ошибок в выводе тестов

---

**Дата создания**: 2024  
**Версия**: 1.0  
**Сервер**: 91.236.198.205:4020