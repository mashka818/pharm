# Руководство по тестированию модуля ФНС

Данное руководство описывает процесс запуска автоматизированных тестов для модуля интеграции с ФНС (Федеральная Налоговая Служба).

## Обзор

Система тестирования включает в себя:
- **Unit тесты** - тестирование отдельных сервисов и их методов
- **Integration тесты** - тестирование взаимодействия между сервисами и контроллерами
- **E2E тесты** - тестирование полного цикла обработки QR кодов
- **Scenario тесты** - тестирование специфических сценариев из документации ФНС

## Структура тестов

```
test/fns/
├── fns.service.spec.ts          # Unit тесты основного сервиса
├── fns-auth.service.spec.ts     # Unit тесты сервиса аутентификации
├── fns-check.service.spec.ts    # Unit тесты сервиса проверки чеков
├── fns.controller.integration.spec.ts  # Integration тесты контроллера
├── fns.e2e.spec.ts             # E2E тесты
├── fns.scenarios.spec.ts       # Сценарии из документации ФНС
└── helpers/
    └── mock-data.ts            # Вспомогательные данные для тестов
```

## Команды для запуска тестов

### Все тесты модуля ФНС

```bash
# Запуск всех тестов ФНС
npm run test:fns

# Запуск с покрытием кода
npm run test:fns:coverage

# Режим наблюдения (перезапуск при изменениях)
npm run test:fns:watch
```

### По типам тестов

```bash
# Только unit тесты
npm run test:fns:unit

# Только integration тесты  
npm run test:fns:integration

# Только E2E тесты
npm run test:fns:e2e

# Только тесты сценариев из документации
npm run test:fns:scenarios

# Последовательный запуск всех типов тестов
npm run test:fns:all
```

### Запуск конкретных тестов

```bash
# Тесты определенного файла
npx jest --config jest.fns.config.js fns.service.spec.ts

# Тесты с определенным паттерном в названии
npx jest --config jest.fns.config.js --testNamePattern="authentication"

# Тесты в режиме отладки
npm run test:fns -- --runInBand --no-cache
```

## Конфигурация для тестирования

### Переменные окружения

Создайте файл `.env.test` для переменных окружения тестов:

```env
NODE_ENV=test
FNS_DEV_MODE=true
FTX_TOKEN=test_master_token
FTX_API_URL=https://openapi.nalog.ru:8090
```

### Mock режим

Тесты автоматически используют mock режим для ФНС API. Для использования реального API:

```bash
# Отключить mock режим (только для интеграционных тестов)
FNS_DEV_MODE=false npm run test:fns:integration
```

## Понимание результатов тестов

### Структура вывода

```
PASS test/fns/fns.service.spec.ts
✓ processScanQrCode should process QR code successfully (15ms)
✓ verifyReceipt should verify receipt successfully (8ms)
✓ getRequestStatus should return request status (5ms)

Test Suites: 1 passed, 1 total
Tests:       25 passed, 25 total
Snapshots:   0 total
Time:        2.345s
```

### Покрытие кода

```
-----------------|---------|----------|---------|---------|
File             | % Stmts | % Branch | % Funcs | % Lines |
-----------------|---------|----------|---------|---------|
All files        |   95.12 |    88.46 |   92.31 |   94.87 |
fns/             |   96.77 |    89.13 |   94.12 |   96.43 |
 fns.service.ts  |   98.25 |    91.67 |   100   |   98.11 |
 fns-auth.service|   94.44 |    85.71 |   88.89 |   93.75 |
-----------------|---------|----------|---------|---------|
```

## Примеры тестовых сценариев

### 1. Unit тестирование сервиса аутентификации

```typescript
describe('FnsAuthService', () => {
  it('should authenticate successfully', async () => {
    // Мокируем успешный ответ ФНС
    mockedAxios.post.mockResolvedValue({
      data: SOAP_RESPONSES.authSuccess
    });

    const token = await fnsAuthService.refreshToken();
    
    expect(token).toBe('c499717f309949d2b8719bf3040efd96');
  });
});
```

### 2. Integration тестирование контроллера

```typescript
describe('FnsController Integration', () => {
  it('should scan QR code via HTTP API', async () => {
    const response = await request(app.getHttpServer())
      .post('/fns/scan-qr')
      .set('host', 'pharmacy.checkpoint.ru')
      .send(mockQrData);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('requestId');
  });
});
```

### 3. E2E тестирование полного цикла

```typescript
describe('Full QR Processing Flow', () => {
  it('should complete end-to-end QR processing', async () => {
    // 1. Отправка QR кода
    const scanResponse = await request(app.getHttpServer())
      .post('/fns/scan-qr')
      .send(mockQrData);

    // 2. Проверка статуса
    const statusResponse = await request(app.getHttpServer())
      .get(`/fns/status/${scanResponse.body.requestId}`);

    expect(statusResponse.body.status).toBe('pending');
  });
});
```

## Отладка тестов

### Включение детального вывода

```bash
# Показать подробную информацию о тестах
npm run test:fns -- --verbose

# Показать все console.log из тестов
npm run test:fns -- --silent=false
```

### Тестирование конкретных сценариев

```bash
# Тесты аутентификации
npx jest --config jest.fns.config.js --testNamePattern="auth"

# Тесты обработки ошибок
npx jest --config jest.fns.config.js --testNamePattern="error"

# Тесты валидации
npx jest --config jest.fns.config.js --testNamePattern="validate"
```

## Решение проблем

### Частые ошибки

#### 1. Timeout ошибки
```bash
# Увеличить timeout для медленных тестов
npm run test:fns -- --testTimeout=60000
```

#### 2. Mock данные не работают
Проверьте, что установлена переменная `FNS_DEV_MODE=true`

#### 3. Ошибки подключения к БД
Убедитесь, что используются mock объекты для PrismaService

### Очистка кэша

```bash
# Очистить кэш Jest
npx jest --clearCache

# Переустановить зависимости
rm -rf node_modules package-lock.json
npm install
```

## Непрерывная интеграция (CI)

### GitHub Actions пример

```yaml
- name: Run FNS Tests
  run: |
    npm run test:fns:coverage
    npm run test:fns:scenarios
  env:
    NODE_ENV: test
    FNS_DEV_MODE: true
```

### Минимальные требования покрытия

- Statements: > 90%
- Branches: > 85%
- Functions: > 90%
- Lines: > 90%

## Документация по сценариям

Тесты покрывают все сценарии из официальной документации ФНС:

### Сценарии аутентификации
- ✅ Успешная аутентификация
- ✅ Timeout ошибка
- ✅ Невалидный запрос
- ✅ Отказ в доступе по IP
- ✅ Внутренняя ошибка сервера

### Сценарии отправки сообщений
- ✅ Успешная отправка
- ✅ Отказ в доступе по IP
- ✅ Отказ в доступе по токену
- ✅ Отсутствие обязательных заголовков
- ✅ Превышение дневного лимита
- ✅ Превышение лимита метода

### Сценарии получения сообщений
- ✅ Статус PROCESSING
- ✅ Статус COMPLETED с данными
- ✅ Сообщение не найдено
- ✅ Rate limiting ошибки

### Обработка файлов
- ✅ Неверное количество ссылок на файлы
- ✅ Файл не найден
- ✅ Невалидные символы в ссылках

## Полезные ссылки

- [Документация ФНС API](./example-api.txt)
- [OpenAPI спецификация](./open-api.txt)
- [Jest документация](https://jestjs.io/docs/getting-started)
- [Supertest для HTTP тестов](https://github.com/visionmedia/supertest)

## Поддержка

При возникновении проблем с тестами:

1. Проверьте переменные окружения
2. Убедитесь в корректности mock данных
3. Проверьте покрытие кода
4. Запустите тесты в debug режиме

```bash
# Debug режим с пошаговым выполнением
npm run test:fns -- --runInBand --detectOpenHandles --forceExit
```