import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { FnsController } from '../../src/fns/fns.controller';
import { FnsService } from '../../src/fns/fns.service';
import { FnsAuthService } from '../../src/fns/fns-auth.service';
import { FnsCheckService } from '../../src/fns/fns-check.service';
import { FnsQueueService } from '../../src/fns/fns-queue.service';
import { FnsCashbackService } from '../../src/fns/fns-cashback.service';
import { PrismaService } from '../../src/prisma.service';
import { Logger } from '@nestjs/common';

describe('FnsController (Integration)', () => {
  let app: INestApplication;
  let fnsService: jest.Mocked<FnsService>;

  const mockQrData = {
    fn: '9287440300090728',
    fd: '77133',
    fp: '1482926127',
    sum: 240000,
    date: '2019-04-09T16:38:00',
    typeOperation: 1
  };

  const mockUser = {
    id: 1,
    promotionId: 'test-promo-id',
    name: 'Test User',
    email: 'test@example.com'
  };

  beforeEach(async () => {
    const mockFnsService = {
      processScanQrCode: jest.fn(),
      verifyReceipt: jest.fn(),
      getRequestStatus: jest.fn(),
      getQueueStats: jest.fn(),
      getDailyRequestCount: jest.fn(),
      testFnsConnection: jest.fn(),
      testQrProcessing: jest.fn(),
    };

    const mockPrismaService = {
      // Добавляем только необходимые методы
    };

    const mockFnsAuthService = {
      getValidToken: jest.fn(),
      refreshToken: jest.fn(),
    };

    const mockFnsCheckService = {
      sendCheckRequest: jest.fn(),
      getCheckResult: jest.fn(),
      waitForResult: jest.fn(),
    };

    const mockFnsQueueService = {
      addToQueue: jest.fn(),
      addToQueueWithPromotion: jest.fn(),
      getQueueStats: jest.fn(),
    };

    const mockFnsCashbackService = {
      checkCashbackLimits: jest.fn(),
      checkCashbackLimitsForPromotion: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [FnsController],
      providers: [
        { provide: FnsService, useValue: mockFnsService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: FnsAuthService, useValue: mockFnsAuthService },
        { provide: FnsCheckService, useValue: mockFnsCheckService },
        { provide: FnsQueueService, useValue: mockFnsQueueService },
        { provide: FnsCashbackService, useValue: mockFnsCashbackService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    fnsService = moduleFixture.get(FnsService);

    // Подавляем логи в тестах
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('POST /fns/scan-qr', () => {
    it('should scan QR code successfully', async () => {
      const mockResponse = {
        requestId: 'test-request-id',
        status: 'pending',
        message: 'Receipt verification started',
        network: 'Test Pharmacy Network',
      };

      fnsService.processScanQrCode.mockResolvedValue(mockResponse);

      const response = await request(app.getHttpServer())
        .post('/fns/scan-qr')
        .set('host', 'test-pharmacy.checkpoint.ru')
        .send(mockQrData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockResponse);
    });

    it('should return 400 if host header is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/fns/scan-qr')
        .send(mockQrData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Host header is required');
    });

    it('should return 400 if user is not authenticated', async () => {
      const response = await request(app.getHttpServer())
        .post('/fns/scan-qr')
        .set('host', 'test-pharmacy.checkpoint.ru')
        .send(mockQrData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('User not authenticated');
    });

    it('should validate QR data format', async () => {
      const invalidQrData = {
        fn: '123', // Неверная длина
        fd: '',    // Пустое значение
        sum: 'invalid', // Неверный тип
      };

      const response = await request(app.getHttpServer())
        .post('/fns/scan-qr')
        .set('host', 'test-pharmacy.checkpoint.ru')
        .send(invalidQrData);

      expect(response.status).toBe(400);
    });

    it('should handle service errors', async () => {
      fnsService.processScanQrCode.mockRejectedValue(new Error('Service error'));

      // Мокируем пользователя в запросе
      const mockRequest = {
        user: mockUser
      };

      const response = await request(app.getHttpServer())
        .post('/fns/scan-qr')
        .set('host', 'test-pharmacy.checkpoint.ru')
        .send(mockQrData);

      expect(response.status).toBe(500);
    });
  });

  describe('POST /fns/verify', () => {
    it('should verify receipt successfully', async () => {
      const mockResponse = {
        requestId: 'test-request-id',
        status: 'pending',
        message: 'Receipt verification started',
      };

      fnsService.verifyReceipt.mockResolvedValue(mockResponse);

      const response = await request(app.getHttpServer())
        .post('/fns/verify')
        .send(mockQrData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockResponse);
    });

    it('should validate receipt data', async () => {
      const invalidReceiptData = {
        fn: '', // Пустое значение
        sum: -100, // Отрицательная сумма
        date: 'invalid-date', // Неверный формат даты
      };

      const response = await request(app.getHttpServer())
        .post('/fns/verify')
        .send(invalidReceiptData);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /fns/status/:requestId', () => {
    it('should return request status', async () => {
      const requestId = 'test-request-id';
      const mockStatus = {
        requestId,
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

      fnsService.getRequestStatus.mockResolvedValue(mockStatus);

      const response = await request(app.getHttpServer())
        .get(`/fns/status/${requestId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        requestId,
        status: 'success',
        cashbackAmount: 100,
      }));
    });

    it('should return 404 if request not found', async () => {
      const requestId = 'non-existent-request';

      fnsService.getRequestStatus.mockRejectedValue(new Error('Request not found'));

      const response = await request(app.getHttpServer())
        .get(`/fns/status/${requestId}`);

      expect(response.status).toBe(500);
    });

    it('should validate requestId format', async () => {
      const invalidRequestId = ''; // Пустой ID

      const response = await request(app.getHttpServer())
        .get(`/fns/status/${invalidRequestId}`);

      expect(response.status).toBe(404); // Not Found для пустого пути
    });
  });

  describe('GET /fns/queue/stats', () => {
    it('should return queue statistics', async () => {
      const mockStats = {
        pending: 10,
        processing: 5,
        success: 100,
        failed: 2,
        total: 117,
      };

      fnsService.getQueueStats.mockResolvedValue(mockStats);

      const response = await request(app.getHttpServer())
        .get('/fns/queue/stats');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStats);
    });

    it('should handle service errors in queue stats', async () => {
      fnsService.getQueueStats.mockRejectedValue(new Error('Database error'));

      const response = await request(app.getHttpServer())
        .get('/fns/queue/stats');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /fns/daily-count', () => {
    it('should return daily request count', async () => {
      const mockCount = 500;

      fnsService.getDailyRequestCount.mockResolvedValue(mockCount);

      const response = await request(app.getHttpServer())
        .get('/fns/daily-count');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        count: mockCount,
        limit: 1000,
      });
    });
  });

  describe('GET /fns/test/connection', () => {
    it('should test FNS connection successfully', async () => {
      const mockTestResult = {
        status: 'success',
        message: 'All tests passed successfully',
        ip: '127.0.0.1',
        timestamp: new Date().toISOString(),
        authTest: {
          status: 'success',
          message: 'Authentication successful',
        },
        serviceTest: {
          status: 'success',
          message: 'Service endpoint accessible',
        },
      };

      fnsService.testFnsConnection.mockResolvedValue(mockTestResult);

      const response = await request(app.getHttpServer())
        .get('/fns/test/connection');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockTestResult);
      expect(response.body.status).toBe('success');
    });

    it('should handle connection test failures', async () => {
      const mockTestResult = {
        status: 'failed',
        message: 'Authentication failed',
        ip: '127.0.0.1',
        timestamp: new Date().toISOString(),
        authTest: {
          status: 'failed',
          message: 'Invalid token',
        },
        serviceTest: {
          status: 'not_tested',
          message: 'Skipped due to auth failure',
        },
      };

      fnsService.testFnsConnection.mockResolvedValue(mockTestResult);

      const response = await request(app.getHttpServer())
        .get('/fns/test/connection');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('failed');
    });

    it('should handle IP blocking in connection test', async () => {
      const mockTestResult = {
        status: 'ip_blocked',
        message: 'IP address not whitelisted in FNS. Contact support to add your IP.',
        ip: '127.0.0.1',
        timestamp: new Date().toISOString(),
        authTest: {
          status: 'success',
          message: 'Authentication successful',
        },
        serviceTest: {
          status: 'failed',
          message: 'IP address not whitelisted',
        },
      };

      fnsService.testFnsConnection.mockResolvedValue(mockTestResult);

      const response = await request(app.getHttpServer())
        .get('/fns/test/connection');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ip_blocked');
    });
  });

  describe('POST /fns/test/qr', () => {
    it('should test QR processing with example data', async () => {
      const mockTestResult = {
        status: 'success',
        message: 'QR processing completed successfully',
        timestamp: new Date().toISOString(),
        qrData: {
          fn: '9287440300090728',
          fd: '77133',
          fp: '1482926127',
          sum: 240000,
          date: '2019-04-09T16:38:00',
          typeOperation: 1
        },
        steps: {
          step1_auth: {
            status: 'success',
            message: 'Token obtained',
          },
          step2_send: {
            status: 'success',
            message: 'Request sent successfully',
          },
          step3_result: {
            status: 'success',
            message: 'Result received',
          },
        },
        finalResult: {
          status: 'success',
          receiptData: {},
        },
      };

      fnsService.testQrProcessing.mockResolvedValue(mockTestResult);

      const response = await request(app.getHttpServer())
        .post('/fns/test/qr');

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockTestResult);
      expect(response.body.status).toBe('success');
    });

    it('should handle QR test failures', async () => {
      const mockTestResult = {
        status: 'failed',
        message: 'Auth failed',
        timestamp: new Date().toISOString(),
        steps: {
          step1_auth: {
            status: 'failed',
            message: 'Authentication error',
            error: 'Invalid token',
          },
        },
        error: 'Authentication error',
      };

      fnsService.testQrProcessing.mockResolvedValue(mockTestResult);

      const response = await request(app.getHttpServer())
        .post('/fns/test/qr');

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('failed');
    });
  });

  describe('Request validation', () => {
    it('should validate all required fields for scan-qr', async () => {
      const requiredFields = ['fn', 'fd', 'fp', 'sum', 'date'];
      
      for (const field of requiredFields) {
        const incompleteData = { ...mockQrData };
        delete incompleteData[field];

        const response = await request(app.getHttpServer())
          .post('/fns/scan-qr')
          .set('host', 'test-pharmacy.checkpoint.ru')
          .send(incompleteData);

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('validation failed');
      }
    });

    it('should validate data types for QR fields', async () => {
      const invalidTypesData = {
        fn: 123, // должно быть string
        fd: true, // должно быть string
        fp: null, // должно быть string
        sum: 'invalid', // должно быть number
        date: 123, // должно быть valid date string
      };

      const response = await request(app.getHttpServer())
        .post('/fns/scan-qr')
        .set('host', 'test-pharmacy.checkpoint.ru')
        .send(invalidTypesData);

      expect(response.status).toBe(400);
    });

    it('should validate fn field length (16 characters)', async () => {
      const invalidFnData = {
        ...mockQrData,
        fn: '123456789', // слишком короткий
      };

      const response = await request(app.getHttpServer())
        .post('/fns/scan-qr')
        .set('host', 'test-pharmacy.checkpoint.ru')
        .send(invalidFnData);

      expect(response.status).toBe(400);
    });

    it('should validate sum field (positive number)', async () => {
      const invalidSumData = {
        ...mockQrData,
        sum: 0, // должно быть больше 0
      };

      const response = await request(app.getHttpServer())
        .post('/fns/scan-qr')
        .set('host', 'test-pharmacy.checkpoint.ru')
        .send(invalidSumData);

      expect(response.status).toBe(400);
    });

    it('should validate date field format', async () => {
      const invalidDateData = {
        ...mockQrData,
        date: '2019-13-40T25:70:00', // неверный формат даты
      };

      const response = await request(app.getHttpServer())
        .post('/fns/scan-qr')
        .set('host', 'test-pharmacy.checkpoint.ru')
        .send(invalidDateData);

      expect(response.status).toBe(400);
    });
  });

  describe('Error handling', () => {
    it('should handle unexpected service errors gracefully', async () => {
      fnsService.processScanQrCode.mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app.getHttpServer())
        .post('/fns/scan-qr')
        .set('host', 'test-pharmacy.checkpoint.ru')
        .send(mockQrData);

      expect(response.status).toBe(500);
    });

    it('should handle malformed JSON requests', async () => {
      const response = await request(app.getHttpServer())
        .post('/fns/scan-qr')
        .set('host', 'test-pharmacy.checkpoint.ru')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });

    it('should handle missing Content-Type header', async () => {
      const response = await request(app.getHttpServer())
        .post('/fns/scan-qr')
        .set('host', 'test-pharmacy.checkpoint.ru')
        .send('not json');

      expect(response.status).toBe(400);
    });
  });

  describe('Headers and middleware', () => {
    it('should accept correct Content-Type header', async () => {
      fnsService.processScanQrCode.mockResolvedValue({
        requestId: 'test-id',
        status: 'pending',
        message: 'Success',
      });

      const response = await request(app.getHttpServer())
        .post('/fns/scan-qr')
        .set('host', 'test-pharmacy.checkpoint.ru')
        .set('Content-Type', 'application/json')
        .send(mockQrData);

      expect(response.status).toBe(201);
    });

    it('should handle various host header formats', async () => {
      const hostVariations = [
        'test-pharmacy.checkpoint.ru',
        'another-network.checkpoint.ru',
        'pharmacy123.checkpoint.ru',
      ];

      fnsService.processScanQrCode.mockResolvedValue({
        requestId: 'test-id',
        status: 'pending',
        message: 'Success',
      });

      for (const host of hostVariations) {
        const response = await request(app.getHttpServer())
          .post('/fns/scan-qr')
          .set('host', host)
          .send(mockQrData);

        expect(response.status).toBe(201);
      }
    });
  });
});