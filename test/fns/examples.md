# Примеры тестов для модуля ФНС

Этот файл содержит примеры того, как писать тесты для модуля ФНС, следуя лучшим практикам.

## Базовый Unit тест

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { FnsAuthService } from '../../src/fns/fns-auth.service';
import { SOAP_RESPONSES, createMockAxiosResponse } from './helpers/mock-data';

describe('FnsAuthService', () => {
  let service: FnsAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FnsAuthService, /* ... other providers */],
    }).compile();

    service = module.get<FnsAuthService>(FnsAuthService);
  });

  it('should authenticate successfully', async () => {
    // Arrange
    const expectedToken = 'c499717f309949d2b8719bf3040efd96';
    mockedAxios.post.mockResolvedValue(
      createMockAxiosResponse(SOAP_RESPONSES.authSuccess)
    );

    // Act
    const result = await service.refreshToken();

    // Assert
    expect(result).toBe(expectedToken);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/open-api/AuthService/0.1'),
      expect.stringContaining('<tns:MasterToken>'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'text/xml;charset=UTF-8'
        })
      })
    );
  });
});
```

## Integration тест с HTTP запросами

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { FnsModule } from '../../src/fns/fns.module';

describe('FnsController (Integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [FnsModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should process QR code scan', async () => {
    // Arrange
    const qrData = createMockQrData();
    const host = 'test-pharmacy.checkpoint.ru';

    // Act
    const response = await request(app.getHttpServer())
      .post('/fns/scan-qr')
      .set('host', host)
      .send(qrData);

    // Assert
    expect(response.status).toBe(201);
    expect(response.body).toEqual(
      expect.objectContaining({
        requestId: expect.any(String),
        status: 'pending',
        message: expect.stringContaining('verification started')
      })
    );
  });
});
```

## E2E тест полного сценария

```typescript
describe('Complete QR Processing Workflow (E2E)', () => {
  it('should process QR code from scan to result', async () => {
    // Arrange
    const qrData = createMockQrData();
    const host = 'test-pharmacy.checkpoint.ru';

    // Act 1: Scan QR code
    const scanResponse = await request(app.getHttpServer())
      .post('/fns/scan-qr')
      .set('host', host)
      .send(qrData);

    expect(scanResponse.status).toBe(201);
    const { requestId } = scanResponse.body;

    // Act 2: Check status
    const statusResponse = await request(app.getHttpServer())
      .get(`/fns/status/${requestId}`);

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.requestId).toBe(requestId);

    // Act 3: Verify in queue stats
    const statsResponse = await request(app.getHttpServer())
      .get('/fns/queue/stats');

    expect(statsResponse.status).toBe(200);
    expect(statsResponse.body.total).toBeGreaterThan(0);
  });
});
```

## Тестирование ошибок

```typescript
describe('Error Handling', () => {
  it('should handle FNS timeout errors', async () => {
    // Arrange
    const timeoutError = createMockAxiosError(SOAP_ERRORS.timeout, 500);
    mockedAxios.post.mockRejectedValue(timeoutError);

    // Act & Assert
    await expect(service.refreshToken()).rejects.toThrow(
      'FNS authentication failed'
    );

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('should handle IP blocking', async () => {
    // Arrange
    const ipBlockedError = createMockAxiosError(SOAP_ERRORS.ipBlocked, 500);
    mockedAxios.post.mockRejectedValue(ipBlockedError);

    // Act & Assert
    await expect(service.refreshToken()).rejects.toThrow(
      'IP address not whitelisted in FNS'
    );
  });
});
```

## Тестирование с таймерами

```typescript
describe('Async Operations', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should wait for result with polling', async () => {
    // Arrange
    const messageId = 'test-message-id';
    const token = 'test-token';
    
    mockedAxios.post
      .mockResolvedValueOnce(createMockAxiosResponse(SOAP_RESPONSES.getMessageProcessing))
      .mockResolvedValueOnce(createMockAxiosResponse(SOAP_RESPONSES.getMessageCompleted));

    // Act
    const resultPromise = service.waitForResult(messageId, token, 2);
    
    // Fast-forward timers
    jest.advanceTimersByTime(5000);
    
    const result = await resultPromise;

    // Assert
    expect(result.status).toBe('success');
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
  });
});
```

## Тестирование валидации

```typescript
describe('Data Validation', () => {
  it('should validate QR data format', async () => {
    const testCases = [
      {
        name: 'missing fn field',
        data: { fd: '123', fp: '456', sum: 1000, date: '2021-01-01T10:00:00' },
        expectedError: 'validation failed'
      },
      {
        name: 'invalid fn length',
        data: { fn: '123', fd: '456', fp: '789', sum: 1000, date: '2021-01-01T10:00:00' },
        expectedError: 'validation failed'
      },
      {
        name: 'negative sum',
        data: { fn: '1234567890123456', fd: '456', fp: '789', sum: -100, date: '2021-01-01T10:00:00' },
        expectedError: 'validation failed'
      }
    ];

    for (const testCase of testCases) {
      const response = await request(app.getHttpServer())
        .post('/fns/verify')
        .send(testCase.data);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain(testCase.expectedError);
    }
  });
});
```

## Мокирование сложных сценариев

```typescript
describe('Complex Scenarios', () => {
  it('should handle rate limiting with retry logic', async () => {
    // Arrange
    const rateLimitError = createMockAxiosError(SOAP_ERRORS.rateLimiting, 429);
    const successResponse = createMockAxiosResponse(SOAP_RESPONSES.sendMessageSuccess);
    
    mockedAxios.post
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce(successResponse);

    // Act
    const result = await service.sendCheckRequestWithRetry(mockQrData, 'token');

    // Assert
    expect(result).toBeDefined();
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
  });
});
```

## Тестирование SOAP структуры

```typescript
describe('SOAP Request Structure', () => {
  it('should generate valid SOAP request', async () => {
    // Arrange
    const qrData = createMockQrData();
    const token = 'test-token';
    
    mockedAxios.post.mockResolvedValue(
      createMockAxiosResponse(SOAP_RESPONSES.sendMessageSuccess)
    );

    // Act
    await service.sendCheckRequest(qrData, token);

    // Assert
    const [url, soapBody, config] = mockedAxios.post.mock.calls[0];
    
    expect(url).toContain('/open-api/ais3/KktService/0.1');
    expect(validateSoapRequest(soapBody)).toBe(true);
    expect(validateSoapHeaders(config.headers)).toBe(true);
    
    // Проверяем содержимое SOAP
    expect(soapBody).toContain(`<tns:Sum>${qrData.sum}</tns:Sum>`);
    expect(soapBody).toContain(`<tns:Fn>${qrData.fn}</tns:Fn>`);
    expect(soapBody).toContain('<tns:RawData>true</tns:RawData>');
  });
});
```

## Параметризованные тесты

```typescript
describe('Parametrized Tests', () => {
  const errorScenarios = [
    {
      name: 'Daily limit exceeded',
      soapError: SOAP_ERRORS.dailyLimitExceeded,
      expectedMessage: 'Daily request limit exceeded'
    },
    {
      name: 'Token access denied',
      soapError: SOAP_ERRORS.tokenDenied,
      expectedMessage: 'Authentication failed'
    },
    {
      name: 'Message not found',
      soapError: SOAP_ERRORS.messageNotFound,
      expectedMessage: 'Message not found'
    }
  ];

  errorScenarios.forEach(scenario => {
    it(`should handle ${scenario.name}`, async () => {
      // Arrange
      const error = createMockAxiosError(scenario.soapError, 500);
      mockedAxios.post.mockRejectedValue(error);

      // Act & Assert
      await expect(service.sendCheckRequest(mockQrData, 'token'))
        .rejects.toThrow(scenario.expectedMessage);
    });
  });
});
```

## Лучшие практики

### 1. Используйте описательные названия тестов
```typescript
// ❌ Плохо
it('should work', () => {});

// ✅ Хорошо
it('should authenticate successfully with valid master token', () => {});
```

### 2. Следуйте AAA паттерну (Arrange, Act, Assert)
```typescript
it('should process QR code', async () => {
  // Arrange - подготовка данных
  const qrData = createMockQrData();
  setupMocks();

  // Act - выполнение действия
  const result = await service.processQrCode(qrData);

  // Assert - проверка результата
  expect(result).toBeDefined();
});
```

### 3. Очищайте состояние между тестами
```typescript
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});
```

### 4. Используйте типизированные моки
```typescript
const mockService = {
  method: jest.fn(),
} as jest.Mocked<ServiceType>;
```

### 5. Тестируйте edge cases
```typescript
describe('Edge Cases', () => {
  it('should handle empty QR data', () => {});
  it('should handle malformed XML response', () => {});
  it('should handle network timeouts', () => {});
});
```

### 6. Группируйте связанные тесты
```typescript
describe('Authentication', () => {
  describe('when credentials are valid', () => {
    it('should authenticate successfully', () => {});
    it('should cache the token', () => {});
  });

  describe('when credentials are invalid', () => {
    it('should throw authentication error', () => {});
    it('should not cache invalid tokens', () => {});
  });
});
```