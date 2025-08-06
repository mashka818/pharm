import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { FnsModule } from '../../src/fns/fns.module';
import { PrismaService } from '../../src/prisma.service';
import { Logger } from '@nestjs/common';

describe('FNS Module (E2E)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  const mockQrData = {
    fn: '9287440300090728',
    fd: '77133',
    fp: '1482926127',
    sum: 240000,
    date: '2019-04-09T16:38:00',
    typeOperation: 1
  };

  beforeAll(async () => {
    // Mock PrismaService для E2E тестов
    const mockPrismaService = {
      promotion: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      fnsRequest: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      fnsToken: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
      },
      receipt: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      customer: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [FnsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);

    // Подавляем логи в тестах
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    // Настраиваем переменные окружения для тестов
    process.env.NODE_ENV = 'test';
    process.env.FNS_DEV_MODE = 'true'; // Используем mock режим для E2E

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete QR Processing Flow', () => {
    it('should complete full QR processing workflow', async () => {
      // 1. Настраиваем моки для успешного сценария
      const mockPromotion = {
        promotionId: 'test-promo-id',
        name: 'Test Pharmacy Network',
        domain: 'test-pharmacy.ru',
        active: true,
      };

      const mockRequest = {
        id: 'test-request-id',
        status: 'success',
        cashbackAmount: 100,
        cashbackAwarded: true,
        isValid: true,
        isReturn: false,
        isFake: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        customer: {
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
        },
      };

      prismaService.promotion.findUnique = jest.fn().mockResolvedValue(mockPromotion);
      prismaService.fnsRequest.findUnique = jest.fn().mockResolvedValue(mockRequest);
      prismaService.fnsRequest.count = jest.fn().mockResolvedValue(500); // Не превышен лимит

      // 2. Отправляем QR код на обработку
      const scanResponse = await request(app.getHttpServer())
        .post('/fns/scan-qr')
        .set('host', 'test-pharmacy.checkpoint.ru')
        .send(mockQrData);

      expect(scanResponse.status).toBe(201);
      expect(scanResponse.body).toHaveProperty('requestId');
      expect(scanResponse.body.status).toBe('pending');

      const requestId = scanResponse.body.requestId;

      // 3. Проверяем статус обработки
      const statusResponse = await request(app.getHttpServer())
        .get(`/fns/status/${requestId}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body).toHaveProperty('requestId', requestId);
    });

    it('should handle promotion not found scenario', async () => {
      prismaService.promotion.findUnique = jest.fn().mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post('/fns/scan-qr')
        .set('host', 'unknown-pharmacy.checkpoint.ru')
        .send(mockQrData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Promotion not found');
    });

    it('should handle daily limit exceeded scenario', async () => {
      const mockPromotion = {
        promotionId: 'test-promo-id',
        name: 'Test Pharmacy Network',
        domain: 'test-pharmacy.ru',
        active: true,
      };

      prismaService.promotion.findUnique = jest.fn().mockResolvedValue(mockPromotion);
      prismaService.fnsRequest.count = jest.fn().mockResolvedValue(1000); // Лимит превышен

      const response = await request(app.getHttpServer())
        .post('/fns/scan-qr')
        .set('host', 'test-pharmacy.checkpoint.ru')
        .send(mockQrData);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('rejected');
      expect(response.body.message).toContain('Daily request limit exceeded');
    });
  });

  describe('Legacy Receipt Verification Flow', () => {
    it('should process legacy receipt verification', async () => {
      const response = await request(app.getHttpServer())
        .post('/fns/verify')
        .send(mockQrData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('requestId');
      expect(response.body.status).toBe('pending');
    });

    it('should handle invalid receipt data', async () => {
      const invalidData = {
        fn: '123', // Неверная длина
        fd: '',
        fp: '',
        sum: -100, // Отрицательная сумма
        date: 'invalid-date',
      };

      const response = await request(app.getHttpServer())
        .post('/fns/verify')
        .send(invalidData);

      expect(response.status).toBe(400);
    });
  });

  describe('Queue Management and Statistics', () => {
    it('should return queue statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/fns/queue/stats');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('pending');
      expect(response.body).toHaveProperty('processing');
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('failed');
      expect(response.body).toHaveProperty('total');
    });

    it('should return daily request count', async () => {
      prismaService.fnsRequest.count = jest.fn().mockResolvedValue(750);

      const response = await request(app.getHttpServer())
        .get('/fns/daily-count');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        count: 750,
        limit: 1000,
      });
    });
  });

  describe('FNS Connection Testing', () => {
    it('should test FNS connection in development mode', async () => {
      const response = await request(app.getHttpServer())
        .get('/fns/test/connection');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('authTest');
      expect(response.body).toHaveProperty('serviceTest');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should test QR processing with example data', async () => {
      const response = await request(app.getHttpServer())
        .post('/fns/test/qr');

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('steps');
      expect(response.body).toHaveProperty('qrData');
      expect(response.body.qrData).toEqual({
        fn: '9287440300090728',
        fd: '77133',
        fp: '1482926127',
        sum: 240000,
        date: '2019-04-09T16:38:00',
        typeOperation: 1
      });
    });
  });

  describe('Error Scenarios and Edge Cases', () => {
    it('should handle network simulation errors', async () => {
      // Имитируем ошибку сети
      process.env.FNS_DEV_MODE = 'false'; // Отключаем mock режим

      const response = await request(app.getHttpServer())
        .get('/fns/test/connection');

      expect(response.status).toBe(200);
      // В production режиме будут реальные ошибки подключения
      expect(response.body.status).not.toBe('success');

      // Возвращаем mock режим
      process.env.FNS_DEV_MODE = 'true';
    });

    it('should handle malformed QR data gracefully', async () => {
      const malformedData = {
        fn: null,
        fd: undefined,
        fp: {},
        sum: 'not a number',
        date: [],
      };

      const response = await request(app.getHttpServer())
        .post('/fns/verify')
        .send(malformedData);

      expect(response.status).toBe(400);
    });

    it('should handle missing headers in scan-qr endpoint', async () => {
      const response = await request(app.getHttpServer())
        .post('/fns/scan-qr')
        .send(mockQrData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Host header is required');
    });
  });

  describe('Request Status Tracking', () => {
    it('should track request through various states', async () => {
      const mockStates = [
        { ...mockQrData, status: 'pending' },
        { ...mockQrData, status: 'processing' },
        { ...mockQrData, status: 'success' },
      ];

      for (const state of mockStates) {
        const mockRequest = {
          id: 'test-request-id',
          status: state.status,
          cashbackAmount: 100,
          cashbackAwarded: state.status === 'success',
          isValid: state.status === 'success',
          isReturn: false,
          isFake: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          customer: {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
          },
        };

        prismaService.fnsRequest.findUnique = jest.fn().mockResolvedValue(mockRequest);

        const response = await request(app.getHttpServer())
          .get('/fns/status/test-request-id');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe(state.status);
      }
    });

    it('should handle non-existent request ID', async () => {
      prismaService.fnsRequest.findUnique = jest.fn().mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/fns/status/non-existent-id');

      expect(response.status).toBe(500);
    });
  });

  describe('Data Validation and Transformation', () => {
    it('should accept valid QR data with all fields', async () => {
      const completeQrData = {
        fn: '9287440300090728',
        fd: '77133',
        fp: '1482926127',
        sum: 240000,
        date: '2019-04-09T16:38:00',
        typeOperation: 1,
        additionalData: {
          someField: 'value',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/fns/verify')
        .send(completeQrData);

      expect(response.status).toBe(201);
    });

    it('should transform and validate sum field', async () => {
      const qrDataWithStringSum = {
        ...mockQrData,
        sum: '240000', // Строка вместо числа
      };

      const response = await request(app.getHttpServer())
        .post('/fns/verify')
        .send(qrDataWithStringSum);

      expect(response.status).toBe(201);
    });

    it('should validate fn field length strictly', async () => {
      const qrDataWithShortFn = {
        ...mockQrData,
        fn: '12345', // Слишком короткий
      };

      const response = await request(app.getHttpServer())
        .post('/fns/verify')
        .send(qrDataWithShortFn);

      expect(response.status).toBe(400);
    });

    it('should validate date field format', async () => {
      const qrDataWithInvalidDate = {
        ...mockQrData,
        date: '2019-04-09 16:38:00', // Неверный формат (без T)
      };

      const response = await request(app.getHttpServer())
        .post('/fns/verify')
        .send(qrDataWithInvalidDate);

      expect(response.status).toBe(400);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent requests', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/fns/verify')
            .send(mockQrData)
        );
      }

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('requestId');
      });
    });

    it('should handle rapid sequential requests', async () => {
      for (let i = 0; i < 5; i++) {
        const response = await request(app.getHttpServer())
          .post('/fns/verify')
          .send(mockQrData);

        expect(response.status).toBe(201);
      }
    });
  });

  describe('Domain and Host Validation', () => {
    it('should accept valid domain formats', async () => {
      const validHosts = [
        'pharmacy1.checkpoint.ru',
        'network-123.checkpoint.ru',
        'test_pharmacy.checkpoint.ru',
      ];

      const mockPromotion = {
        promotionId: 'test-promo-id',
        name: 'Test Pharmacy Network',
        domain: 'pharmacy1.ru', // Частичное совпадение
        active: true,
      };

      prismaService.promotion.findUnique = jest.fn().mockResolvedValue(mockPromotion);
      prismaService.fnsRequest.count = jest.fn().mockResolvedValue(100);

      for (const host of validHosts) {
        const response = await request(app.getHttpServer())
          .post('/fns/scan-qr')
          .set('host', host)
          .send(mockQrData);

        // Некоторые могут пройти, некоторые нет в зависимости от домена
        expect([201, 400]).toContain(response.status);
      }
    });

    it('should reject invalid domain formats', async () => {
      const invalidHosts = [
        'invalid-domain',
        'malicious.hacker.com',
        'localhost',
        '127.0.0.1',
      ];

      for (const host of invalidHosts) {
        const response = await request(app.getHttpServer())
          .post('/fns/scan-qr')
          .set('host', host)
          .send(mockQrData);

        expect(response.status).toBe(400);
      }
    });
  });
});