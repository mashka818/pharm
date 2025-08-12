import { Test, TestingModule } from '@nestjs/testing';
import { CashbackService } from './cashback.service';
import { PrismaService } from '../prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CashbackStatus } from '@prisma/client';

describe('CashbackService', () => {
  let service: CashbackService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    offer: {
      findMany: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
    },
    cashback: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    customer: {
      update: jest.fn(),
    },
    fnsRequest: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashbackService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CashbackService>(CashbackService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateCashback', () => {
    it('should calculate cashback correctly with active offers', async () => {
      const mockOffers = [
        {
          id: 1,
          profit: 5,
          profitType: 'from',
          products: [
            {
              product: {
                id: 1,
                name: 'Аспирин',
                sku: 'ASP001',
              },
            },
          ],
          condition: null,
        },
      ];

      const mockReceiptData = {
        items: [
          {
            name: 'Аспирин',
            sku: 'ASP001',
            price: 100,
            quantity: 2,
            sum: 200,
          },
        ],
      };

      mockPrismaService.offer.findMany.mockResolvedValue(mockOffers);

      const result = await service.calculateCashback(
        mockReceiptData,
        1,
        'promo-1'
      );

      expect(result.totalCashback).toBe(10); // 5% от 200 коп
      expect(result.items).toHaveLength(1);
      expect(result.appliedOffers).toContain(1);
    });

    it('should return zero cashback when no matching offers', async () => {
      mockPrismaService.offer.findMany.mockResolvedValue([]);
      mockPrismaService.product.findFirst.mockResolvedValue(null);

      const mockReceiptData = {
        items: [
          {
            name: 'Unknown Product',
            sku: 'UNK001',
            price: 100,
            quantity: 1,
            sum: 100,
          },
        ],
      };

      const result = await service.calculateCashback(
        mockReceiptData,
        1,
        'promo-1'
      );

      expect(result.totalCashback).toBe(0);
      expect(result.items).toHaveLength(0);
    });
  });

  describe('awardCashback', () => {
    it('should award cashback successfully', async () => {
      const mockCalculationResult = {
        totalCashback: 1000,
        items: [
          {
            productName: 'Test Product',
            quantity: 1,
            itemPrice: 500,
            totalPrice: 500,
            cashbackAmount: 1000,
            cashbackType: 'percent' as const,
            cashbackRate: 5,
          },
        ],
        appliedOffers: [1],
      };

      const mockCashback = { id: 123 };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          cashback: {
            create: jest.fn().mockResolvedValue(mockCashback),
          },
          customer: {
            update: jest.fn(),
          },
          fnsRequest: {
            update: jest.fn(),
          },
        };
        return callback(tx);
      });

      const result = await service.awardCashback(
        1,
        'request-123',
        null,
        'promo-1',
        mockCalculationResult
      );

      expect(result.cashbackId).toBe(123);
      expect(result.amount).toBe(1000);
    });
  });

  describe('cancelCashback', () => {
    it('should cancel cashback successfully', async () => {
      const mockCashback = {
        id: 1,
        amount: 1000,
        status: CashbackStatus.active,
        customerId: 1,
        fnsRequestId: 'request-123',
        customer: {
          bonuses: 2000,
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          cashback: {
            findUnique: jest.fn().mockResolvedValue(mockCashback),
            update: jest.fn(),
          },
          customer: {
            update: jest.fn(),
          },
          fnsRequest: {
            update: jest.fn(),
          },
        };
        return callback(tx);
      });

      const result = await service.cancelCashback(1, 1, 'Test reason');

      expect(result.success).toBe(true);
      expect(result.refundedAmount).toBe(1000);
    });

    it('should throw NotFoundException for non-existent cashback', async () => {
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          cashback: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(tx);
      });

      await expect(
        service.cancelCashback(999, 1, 'Test reason')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for already cancelled cashback', async () => {
      const mockCashback = {
        id: 1,
        status: CashbackStatus.cancelled,
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          cashback: {
            findUnique: jest.fn().mockResolvedValue(mockCashback),
          },
        };
        return callback(tx);
      });

      await expect(
        service.cancelCashback(1, 1, 'Test reason')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when customer has insufficient bonuses', async () => {
      const mockCashback = {
        id: 1,
        amount: 1000,
        status: CashbackStatus.active,
        customer: {
          bonuses: 500, // Less than cashback amount
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          cashback: {
            findUnique: jest.fn().mockResolvedValue(mockCashback),
          },
        };
        return callback(tx);
      });

      await expect(
        service.cancelCashback(1, 1, 'Test reason')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTodaysCashbackHistory', () => {
    it('should return todays cashback history', async () => {
      const mockHistory = [
        {
          id: 1,
          amount: 1000,
          status: CashbackStatus.active,
          createdAt: new Date(),
        },
      ];

      mockPrismaService.cashback.findMany.mockResolvedValue(mockHistory);

      const result = await service.getTodaysCashbackHistory();

      expect(result).toEqual(mockHistory);
      expect(mockPrismaService.cashback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.any(Object),
          }),
        })
      );
    });

    it('should filter by promotionId when provided', async () => {
      mockPrismaService.cashback.findMany.mockResolvedValue([]);

      await service.getTodaysCashbackHistory('promo-1');

      expect(mockPrismaService.cashback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            promotionId: 'promo-1',
          }),
        })
      );
    });
  });

  describe('private methods', () => {
    it('should normalize product names correctly', async () => {
      // We need to access private method through reflection
      const normalizeMethod = (service as any).normalizeProductName;
      
      expect(normalizeMethod('АСПИРИН 500МГ №20')).toBe('аспирин 500мг 20');
      expect(normalizeMethod('Витамин C, 100мг')).toBe('витамин c 100мг');
      expect(normalizeMethod('  Multiple   Spaces  ')).toBe('multiple spaces');
    });

    it('should calculate name similarity correctly', async () => {
      const similarityMethod = (service as any).calculateNameSimilarity;
      
      expect(similarityMethod('аспирин 500мг', 'аспирин 500мг')).toBe(1);
      expect(similarityMethod('аспирин', 'аспирин 500мг')).toBeGreaterThan(0.5);
      expect(similarityMethod('totally different', 'another product')).toBe(0);
    });

    it('should parse prices correctly', async () => {
      const parseMethod = (service as any).parsePrice;
      
      expect(parseMethod(100)).toBe(100);
      expect(parseMethod('100')).toBe(10000); // Converts to kopecks
      expect(parseMethod('1.50')).toBe(150);
      expect(parseMethod('invalid')).toBe(0);
    });
  });
});