# Тестирование модуля ФНС - Быстрый старт

## Основные команды

```bash
# Запуск всех тестов ФНС
npm run test:fns

# Запуск с покрытием кода
npm run test:fns:coverage

# Режим наблюдения
npm run test:fns:watch
```

## Типы тестов

```bash
npm run test:fns:unit        # Unit тесты
npm run test:fns:integration # Integration тесты  
npm run test:fns:e2e         # E2E тесты
npm run test:fns:scenarios   # Сценарии из документации ФНС
npm run test:fns:all         # Все типы последовательно
```

## Быстрая проверка

```bash
# Проверить основную функциональность
npm run test:fns:unit

# Проверить API endpoints
npm run test:fns:integration

# Проверить полный цикл
npm run test:fns:e2e
```

## Структура тестов

- 📁 `test/fns/` - Все тесты модуля ФНС
- 🧪 `*.spec.ts` - Unit тесты сервисов
- 🔗 `*.integration.spec.ts` - Integration тесты
- 🌐 `*.e2e.spec.ts` - End-to-End тесты
- 📋 `*.scenarios.spec.ts` - Сценарии из документации

## Покрытие тестами

Тесты покрывают:
- ✅ Аутентификацию в ФНС API
- ✅ Отправку и получение SOAP запросов
- ✅ Обработку всех ошибок из документации
- ✅ Валидацию QR кодов
- ✅ Rate limiting и timeout обработку
- ✅ HTTP API endpoints
- ✅ Полный цикл обработки чеков

## Переменные окружения

```env
NODE_ENV=test
FNS_DEV_MODE=true  # Включает mock режим для безопасного тестирования
```

## Результат успешного запуска

```
PASS test/fns/fns.service.spec.ts (8.42s)
PASS test/fns/fns-auth.service.spec.ts (3.21s)
PASS test/fns/fns-check.service.spec.ts (5.67s)
PASS test/fns/fns.controller.integration.spec.ts (4.89s)
PASS test/fns/fns.e2e.spec.ts (7.15s)
PASS test/fns/fns.scenarios.spec.ts (12.34s)

Test Suites: 6 passed, 6 total
Tests:       127 passed, 127 total
Coverage:    95.4% statements, 89.2% branches
```

📖 **Подробная документация**: [docs/FNS_TESTING_GUIDE.md](docs/FNS_TESTING_GUIDE.md)