import { Test, TestingModule } from '@nestjs/testing';
import { FnsService } from '../../src/fns/fns.service';
import { FnsAuthService } from '../../src/fns/fns-auth.service';
import { FnsCheckService } from '../../src/fns/fns-check.service';
import { FnsQueueService } from '../../src/fns/fns-queue.service';
import { FnsCashbackService } from '../../src/fns/fns-cashback.service';
import { PrismaService } from '../../src/prisma.service';
import { BadRequestException, Logger } from '@nestjs/common';

describe('FnsService', () => {
  let service: FnsService;
  let fnsAuthService: jest.Mocked<FnsAuthService>;
  let fnsCheckService: jest.Mocked<FnsCheckService>;
  let fnsQueueService: jest.Mocked<FnsQueueService>;
  let fnsCashbackService: jest.Mocked<FnsCashbackService>;
  let prismaService: jest.Mocked<PrismaService>;

  const mockQrData = {
    fn: '9287440300090728',
    fd: '77133',
    fp: '1482926127',
    sum: 240000,
    date: '2019-04-09T16:38:00',
    typeOperation: 1
  };

  const mockPromotion = {
    promotionId: 'test-promo-id',
    name: 'Test Pharmacy Network',
    domain: 'test-pharmacy.ru',
    active: true
  };

  beforeEach(async () => {
    const mockFnsAuthService = {
      getValidToken: jest.fn(),
      refreshToken: jest.fn(),
      loadTokenFromDb: jest.fn(),
    };

    const mockFnsCheckService = {
      sendCheckRequest: jest.fn(),
      getCheckResult: jest.fn(),
      waitForResult: jest.fn(),
    };

    const mockFnsQueueService = {
      addToQueue: jest.fn(),
      addToQueueWithPromotion: jest.fn(),
      getPendingRequests: jest.fn(),
      incrementAttempts: jest.fn(),
      markRequestAsProcessing: jest.fn(),
      markRequestAsFailed: jest.fn(),
      updateRequestStatus: jest.fn(),
      getQueueStats: jest.fn(),
      cleanupOldRequests: jest.fn(),
    };

    const mockFnsCashbackService = {
      checkCashbackLimits: jest.fn(),
      checkCashbackLimitsForPromotion: jest.fn(),
      calculateCashback: jest.fn(),
      awardCashbackToCustomer: jest.fn(),
    };

    const mockPrismaService = {
      promotion: {
        findUnique: jest.fn(),
      },
      fnsRequest: {
        findUnique: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      receipt: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FnsService,
        { provide: FnsAuthService, useValue: mockFnsAuthService },
        { provide: FnsCheckService, useValue: mockFnsCheckService },
        { provide: FnsQueueService, useValue: mockFnsQueueService },
        { provide: FnsCashbackService, useValue: mockFnsCashbackService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<FnsService>(FnsService);
    fnsAuthService = module.get(FnsAuthService);
    fnsCheckService = module.get(FnsCheckService);
    fnsQueueService = module.get(FnsQueueService);
    fnsCashbackService = module.get(FnsCashbackService);
    prismaService = module.get(PrismaService);

    // Подавляем логи в тестах
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processScanQrCode', () => {
    it('should process QR code successfully', async () => {
      const customerId = 1;
      const promotionId = 'test-promo-id';
      const host = 'test-pharmacy.checkpoint.ru';
      const requestId = 'test-request-id';

      prismaService.promotion.findUnique.mockResolvedValue(mockPromotion);
      fnsCashbackService.checkCashbackLimitsForPromotion.mockResolvedValue(true);
      fnsQueueService.addToQueueWithPromotion.mockResolvedValue(requestId);

      const result = await service.processScanQrCode(mockQrData, customerId, promotionId, host);

      expect(result).toEqual({
        requestId,
        status: 'pending',
        message: 'Receipt verification started',
        network: mockPromotion.name,
      });

      expect(prismaService.promotion.findUnique).toHaveBeenCalledWith({
        where: { promotionId },
      });
      expect(fnsCashbackService.checkCashbackLimitsForPromotion).toHaveBeenCalledWith(
        customerId,
        mockQrData,
        promotionId
      );
      expect(fnsQueueService.addToQueueWithPromotion).toHaveBeenCalledWith(
        mockQrData,
        customerId,
        promotionId
      );
    });

    it('should reject if promotion not found', async () => {
      const customerId = 1;
      const promotionId = 'non-existent-promo';
      const host = 'test-pharmacy.checkpoint.ru';

      prismaService.promotion.findUnique.mockResolvedValue(null);

      await expect(
        service.processScanQrCode(mockQrData, customerId, promotionId, host)
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if invalid domain', async () => {
      const customerId = 1;
      const promotionId = 'test-promo-id';
      const host = 'wrong-domain.ru';

      prismaService.promotion.findUnique.mockResolvedValue(mockPromotion);

      await expect(
        service.processScanQrCode(mockQrData, customerId, promotionId, host)
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if cashback already received', async () => {
      const customerId = 1;
      const promotionId = 'test-promo-id';
      const host = 'test-pharmacy.checkpoint.ru';

      prismaService.promotion.findUnique.mockResolvedValue(mockPromotion);
      fnsCashbackService.checkCashbackLimitsForPromotion.mockResolvedValue(false);

      const result = await service.processScanQrCode(mockQrData, customerId, promotionId, host);

      expect(result).toEqual({
        requestId: null,
        status: 'rejected',
        message: 'Cashback already received for this receipt in this network',
      });
    });

    it('should reject if daily limit exceeded', async () => {
      const customerId = 1;
      const promotionId = 'test-promo-id';
      const host = 'test-pharmacy.checkpoint.ru';

      prismaService.promotion.findUnique.mockResolvedValue(mockPromotion);
      fnsCashbackService.checkCashbackLimitsForPromotion.mockResolvedValue(true);
      // Мокируем превышение дневного лимита
      prismaService.fnsRequest.count.mockResolvedValue(1000);

      const result = await service.processScanQrCode(mockQrData, customerId, promotionId, host);

      expect(result).toEqual({
        requestId: null,
        status: 'rejected',
        message: 'Daily request limit exceeded for this network',
      });
    });
  });

  describe('verifyReceipt', () => {
    it('should verify receipt successfully', async () => {
      const customerId = 1;
      const requestId = 'test-request-id';

      fnsCashbackService.checkCashbackLimits.mockResolvedValue(true);
      fnsQueueService.addToQueue.mockResolvedValue(requestId);

      const result = await service.verifyReceipt(mockQrData, customerId);

      expect(result).toEqual({
        requestId,
        status: 'pending',
        message: 'Receipt verification started',
      });

      expect(fnsCashbackService.checkCashbackLimits).toHaveBeenCalledWith(customerId, mockQrData);
      expect(fnsQueueService.addToQueue).toHaveBeenCalledWith(mockQrData, customerId);
    });

    it('should reject if cashback already received', async () => {
      const customerId = 1;

      fnsCashbackService.checkCashbackLimits.mockResolvedValue(false);

      const result = await service.verifyReceipt(mockQrData, customerId);

      expect(result).toEqual({
        requestId: null,
        status: 'rejected',
        message: 'Cashback already received for this receipt',
      });
    });

    it('should work without customer ID', async () => {
      const requestId = 'test-request-id';

      fnsQueueService.addToQueue.mockResolvedValue(requestId);

      const result = await service.verifyReceipt(mockQrData);

      expect(result).toEqual({
        requestId,
        status: 'pending',
        message: 'Receipt verification started',
      });

      expect(fnsCashbackService.checkCashbackLimits).not.toHaveBeenCalled();
      expect(fnsQueueService.addToQueue).toHaveBeenCalledWith(mockQrData, undefined);
    });
  });

  describe('getRequestStatus', () => {
    it('should return request status', async () => {
      const requestId = 'test-request-id';
      const mockRequest = {
        id: requestId,
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

      prismaService.fnsRequest.findUnique.mockResolvedValue(mockRequest);

      const result = await service.getRequestStatus(requestId);

      expect(result).toEqual({
        requestId,
        status: mockRequest.status,
        cashbackAmount: mockRequest.cashbackAmount,
        cashbackAwarded: mockRequest.cashbackAwarded,
        isValid: mockRequest.isValid,
        isReturn: mockRequest.isReturn,
        isFake: mockRequest.isFake,
        createdAt: mockRequest.createdAt,
        updatedAt: mockRequest.updatedAt,
        customer: mockRequest.customer,
      });
    });

    it('should throw error if request not found', async () => {
      const requestId = 'non-existent-request';

      prismaService.fnsRequest.findUnique.mockResolvedValue(null);

      await expect(service.getRequestStatus(requestId)).rejects.toThrow('Request not found');
    });
  });

  describe('getDailyRequestCount', () => {
    it('should return daily request count', async () => {
      const expectedCount = 500;
      prismaService.fnsRequest.count.mockResolvedValue(expectedCount);

      const result = await service.getDailyRequestCount();

      expect(result).toBe(expectedCount);
      expect(prismaService.fnsRequest.count).toHaveBeenCalledWith({
        where: {
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lt: expect.any(Date),
          }),
        },
      });
    });
  });

  describe('getCustomerCashbackHistory', () => {
    it('should return customer cashback history', async () => {
      const customerId = 1;
      const mockHistory = [
        {
          id: 'request-1',
          cashbackAmount: 100,
          createdAt: new Date(),
          qrData: mockQrData,
        },
      ];

      prismaService.fnsRequest.findMany.mockResolvedValue(mockHistory);

      const result = await service.getCustomerCashbackHistory(customerId);

      expect(result).toEqual(mockHistory);
      expect(prismaService.fnsRequest.findMany).toHaveBeenCalledWith({
        where: {
          customerId,
          cashbackAwarded: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          cashbackAmount: true,
          createdAt: true,
          qrData: true,
        },
      });
    });
  });

  describe('testFnsConnection', () => {
    it('should test FNS connection successfully', async () => {
      const mockToken = 'test-token';
      const mockMessageId = 'test-message-id';

      fnsAuthService.refreshToken.mockResolvedValue(mockToken);
      fnsAuthService.getValidToken.mockResolvedValue(mockToken);
      fnsCheckService.sendCheckRequest.mockResolvedValue(mockMessageId);

      const result = await service.testFnsConnection();

      expect(result.status).toBe('success');
      expect(result.authTest.status).toBe('success');
      expect(result.serviceTest.status).toBe('success');
    });

    it('should handle authentication failure', async () => {
      fnsAuthService.refreshToken.mockRejectedValue(new Error('Auth failed'));

      const result = await service.testFnsConnection();

      expect(result.status).toBe('failed');
      expect(result.authTest.status).toBe('failed');
    });

    it('should handle IP blocking', async () => {
      const mockToken = 'test-token';
      
      fnsAuthService.refreshToken.mockResolvedValue(mockToken);
      fnsAuthService.getValidToken.mockResolvedValue(mockToken);
      fnsCheckService.sendCheckRequest.mockRejectedValue(
        new Error('IP address not whitelisted')
      );

      const result = await service.testFnsConnection();

      expect(result.status).toBe('ip_blocked');
      expect(result.message).toContain('IP address not whitelisted');
    });
  });

  describe('testQrProcessing', () => {
    it('should process QR test successfully', async () => {
      const mockToken = 'test-token';
      const mockMessageId = 'test-message-id';
      const mockResult = { status: 'success', receiptData: {} };

      fnsAuthService.getValidToken.mockResolvedValue(mockToken);
      fnsCheckService.sendCheckRequest.mockResolvedValue(mockMessageId);
      fnsCheckService.waitForResult.mockResolvedValue(mockResult);

      const result = await service.testQrProcessing(mockQrData);

      expect(result.status).toBe('success');
      expect(result.steps.step1_auth.status).toBe('success');
      expect(result.steps.step2_send.status).toBe('success');
      expect(result.steps.step3_result.status).toBe('success');
      expect(result.finalResult).toEqual(mockResult);
    });

    it('should handle errors during QR processing', async () => {
      fnsAuthService.getValidToken.mockRejectedValue(new Error('Auth failed'));

      const result = await service.testQrProcessing(mockQrData);

      expect(result.status).toBe('failed');
      expect(result.steps.step1_auth.status).toBe('failed');
    });
  });
});