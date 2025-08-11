import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FnsAuthService } from './fns-auth.service';
import { FnsCheckService } from './fns-check.service';
import { FnsQueueService } from './fns-queue.service';
import { FnsCashbackService } from './fns-cashback.service';
import { PrismaService } from '../prisma.service';
import { VerifyReceiptDto } from './dto/verify-receipt.dto';
import { ReceiptStatusDto } from './dto/receipt-status.dto';
import { ScanQrCodeDto } from './dto/scan-qr-code.dto';

@Injectable()
export class FnsService {
  private readonly logger = new Logger(FnsService.name);

  constructor(
    private readonly fnsAuthService: FnsAuthService,
    private readonly fnsCheckService: FnsCheckService,
    private readonly fnsQueueService: FnsQueueService,
    private readonly fnsCashbackService: FnsCashbackService,
    private readonly prisma: PrismaService,
  ) {}

  async processScanQrCode(qrData: ScanQrCodeDto, customerId: number, promotionId: string, host: string) {
    this.logger.log(`Processing QR scan for customer ${customerId}, promotion ${promotionId}, host: ${host}`);
    
    try {
      const promotion = await this.prisma.promotion.findUnique({
        where: { promotionId },
      });

      if (!promotion) {
        throw new BadRequestException('Promotion not found');
      }

      const expectedDomain = promotion.domain;
      this.logger.log(`Expected domain: ${expectedDomain}, Actual host: ${host}`);
      
      // Временно отключаем проверку домена для тестирования
      // if (host !== expectedDomain && !host.includes(expectedDomain)) {
      //   this.logger.error(`Domain mismatch: expected ${expectedDomain}, got ${host}`);
      //   throw new BadRequestException('Invalid domain for this promotion');
      // }

      const canReceiveCashback = await this.fnsCashbackService.checkCashbackLimitsForPromotion(
        customerId, 
        qrData, 
        promotionId
      );
      
      if (!canReceiveCashback) {
        return {
          requestId: null,
          status: 'rejected',
          message: 'Cashback already received for this receipt in this network',
        };
      }

      const dailyLimit = await this.checkDailyLimit(promotionId);
      if (!dailyLimit.allowed) {
        return {
          requestId: null,
          status: 'rejected',
          message: 'Daily request limit exceeded for this network',
        };
      }

      const requestId = await this.fnsQueueService.addToQueueWithPromotion(
        qrData, 
        customerId, 
        promotionId
      );
      
      return {
        requestId,
        status: 'pending',
        message: 'Receipt verification started',
        network: promotion.name,
      };
    } catch (error) {
      this.logger.error('Error processing QR scan:', error);
      throw error;
    }
  }

  async verifyReceipt(qrData: VerifyReceiptDto, customerId?: number) {
    this.logger.log(`Starting receipt verification for QR data: ${JSON.stringify(qrData)}`);
    
    try {
      if (customerId) {
        const canReceiveCashback = await this.fnsCashbackService.checkCashbackLimits(customerId, qrData);
        if (!canReceiveCashback) {
          return {
            requestId: null,
            status: 'rejected',
            message: 'Cashback already received for this receipt',
          };
        }
      }

      const requestId = await this.fnsQueueService.addToQueue(qrData, customerId);
      
      return {
        requestId,
        status: 'pending',
        message: 'Receipt verification started',
      };
    } catch (error) {
      this.logger.error('Error starting receipt verification:', error);
      throw error;
    }
  }

  async getRequestStatus(requestId: string): Promise<ReceiptStatusDto> {
    const request = await this.prisma.fnsRequest.findUnique({
      where: { id: requestId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!request) {
      throw new Error('Request not found');
    }

    return {
      requestId,
      status: request.status,
      cashbackAmount: request.cashbackAmount,
      cashbackAwarded: request.cashbackAwarded,
      isValid: request.isValid,
      isReturn: request.isReturn,
      isFake: request.isFake,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      customer: request.customer,
    };
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async processPendingRequests() {
    this.logger.debug('Processing pending FNS requests');
    
    try {
      const pendingRequests = await this.fnsQueueService.getPendingRequests();
      
      for (const request of pendingRequests) {
        await this.processRequest(request);
      }
    } catch (error) {
      this.logger.error('Error processing pending requests:', error);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshTokens() {
    this.logger.debug('Refreshing FNS tokens');
    
    try {
      await this.fnsAuthService.refreshToken();
    } catch (error) {
      this.logger.error('Error refreshing FNS tokens:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldRequests() {
    this.logger.debug('Cleaning up old FNS requests');
    
    try {
      await this.fnsQueueService.cleanupOldRequests();
    } catch (error) {
      this.logger.error('Error cleaning up old requests:', error);
    }
  }

  private async processRequest(request: any) {
    try {
      await this.fnsQueueService.incrementAttempts(request.id);
      await this.fnsQueueService.markRequestAsProcessing(request.id);
      
      const token = await this.fnsAuthService.getValidToken();
      
      const messageId = await this.fnsCheckService.sendCheckRequest(request.qrData, token);
      
      await this.prisma.fnsRequest.update({
        where: { id: request.id },
        data: { 
          messageId,
          lastAttemptAt: new Date(),
        },
      });
      
      const result = await this.fnsCheckService.waitForResult(messageId, token);
      
      await this.handleCheckResult(request.id, result, request.customerId);
      
    } catch (error) {
      this.logger.error(`Error processing request ${request.id}:`, error);
      
      if (error.message.includes('Rate limiting')) {
        this.logger.warn(`Rate limiting for request ${request.id}, will retry later`);
        await this.fnsQueueService.updateRequestStatus(request.id, 'pending');
        return;
      } else if (error.message.includes('Message not found')) {
        await this.fnsQueueService.markRequestAsFailed(request.id, 'Message not found');
      } else if (error.message.includes('Authentication')) {
        await this.fnsQueueService.markRequestAsFailed(request.id, 'Authentication failed');
      } else {
        await this.fnsQueueService.markRequestAsFailed(request.id, error.message);
      }
    }
  }

  private async handleCheckResult(requestId: string, result: any, customerId?: number) {
    const status = result.status;
    
    let fnsRequest;
    try {
      fnsRequest = await this.prisma.fnsRequest.findUnique({
        where: { id: requestId },
        select: { promotionId: true },
      });
    } catch (error) {
      if (error.message.includes('promotionId')) {
        fnsRequest = null;
      } else {
        throw error;
      }
    }
    
    if (status === 'success') {
      const { totalCashback, items: cashbackItems } = await this.fnsCashbackService.calculateCashbackWithBreakdown(
        result.receiptData, 
        customerId, 
        fnsRequest?.promotionId
      );
      
      if (customerId && totalCashback > 0) {
        await this.fnsCashbackService.awardCashbackToCustomer(customerId, totalCashback);
        
        if (fnsRequest?.promotionId) {
          const receiptId = await this.createReceiptRecord(result.receiptData, customerId, fnsRequest.promotionId, totalCashback, cashbackItems);
          await this.createCashbackRecord(receiptId, customerId, fnsRequest.promotionId, totalCashback);
        }
      }
      
      await this.fnsQueueService.updateRequestStatus(requestId, 'success', {
        cashbackAmount: totalCashback,
        cashbackAwarded: totalCashback > 0,
        fnsResponse: result,
      });
    } else if (status === 'rejected') {
      await this.fnsQueueService.updateRequestStatus(requestId, 'rejected', {
        isReturn: result.isReturn,
        isFake: result.isFake,
        fnsResponse: result,
      });
    } else if (status === 'failed') {
      await this.fnsQueueService.updateRequestStatus(requestId, 'failed', {
        isReturn: false,
        isFake: true,
        fnsResponse: result,
      });
    } else {
      await this.fnsQueueService.updateRequestStatus(requestId, status, {
        fnsResponse: result,
      });
    }
  }

  async getQueueStats() {
    return await this.fnsQueueService.getQueueStats();
  }

  async getDailyRequestCount(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return await this.prisma.fnsRequest.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });
  }

  async getTodayCashbacks(promotionId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where: any = {
      createdAt: { gte: today },
      status: 'awarded',
    };

    if (promotionId) where.promotionId = promotionId;

    return this.prisma.cashback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        receipt: true,
        promotion: { select: { promotionId: true, name: true } },
      },
    });
  }

  async cancelCashback(cashbackId: number, adminId?: number) {
    const cb = await this.prisma.cashback.findUnique({ where: { id: cashbackId } });
    if (!cb || cb.status !== 'awarded') {
      throw new BadRequestException('Cashback not found or already canceled');
    }

    await this.prisma.$transaction([
      this.prisma.cashback.update({
        where: { id: cashbackId },
        data: { status: 'canceled', canceledAt: new Date(), canceledByAdminId: adminId ?? null },
      }),
      this.prisma.customer.update({
        where: { id: cb.customerId },
        data: { bonuses: { decrement: cb.amount } },
      }),
    ]);

    return { success: true };
  }

  async getCustomerCashbackHistory(customerId: number) {
    return await this.prisma.fnsRequest.findMany({
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
  }

  private async checkDailyLimit(promotionId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let currentCount = 0;
    try {
      currentCount = await this.prisma.fnsRequest.count({
        where: {
          promotionId,
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      });
    } catch (error) {
      if (error.message.includes('promotionId')) {
        currentCount = await this.prisma.fnsRequest.count({
          where: {
            createdAt: {
              gte: today,
              lt: tomorrow,
            },
          },
        });
      } else {
        throw error;
      }
    }
    
    const limit = 1000; 
    
    return {
      allowed: currentCount < limit,
      current: currentCount,
      limit,
    };
  }

  private async createReceiptRecord(
    receiptData: any,
    customerId: number,
    promotionId: string,
    cashback: number,
    cashbackItems: Array<{ item: any; offer: any | null; cashbackAmount: number }>,
  ): Promise<number> {
    try {
      const receipt = await this.prisma.receipt.create({
        data: {
          date: new Date(receiptData.dateTime || receiptData.date),
          number: parseInt(receiptData.fiscalDocumentNumber || receiptData.fd),
          price: parseInt(receiptData.totalSum || receiptData.sum),
          cashback,
          status: 'success',
          address: receiptData.retailPlace || 'Неизвестно',
          promotionId,
          customerId,
        },
      });

      // persist items (link only if product resolved)
      const items = (receiptData.items || []).map((i: any) => ({
        name: i.name,
        sku: i.sku || i.nds || undefined,
        quantity: parseInt(i.quantity || i.qnty || 1),
        price: parseInt(i.price || i.priceSum || i.sum || 0),
        total: parseInt(i.sum || 0),
      }));

      for (const item of items) {
        const product = await this.prisma.product.findFirst({
          where: {
            OR: [
              item.sku ? { sku: item.sku } : undefined,
              item.name ? { name: { contains: item.name, mode: 'insensitive' } } : undefined,
            ].filter(Boolean) as any,
          },
          select: { id: true },
        });

        if (!product) continue;

        const matched = cashbackItems.find(
          (ci) => ci.item.name === item.name && Math.round(ci.item.total) === Math.round(item.total)
        );

        await this.prisma.receiptProduct.create({
          data: {
            cashback: matched?.cashbackAmount ?? 0,
            quantity: item.quantity,
            price: item.price,
            total: item.total,
            product: { connect: { id: product.id } },
            offer: matched?.offer ? { connect: { id: matched.offer.id } } : undefined,
            Receipt: { connect: { id: receipt.id } },
          },
        });
      }

      this.logger.log(`Created receipt record with ID: ${receipt.id}`);
      return receipt.id;
    } catch (error) {
      this.logger.error('Error creating receipt record:', error);
      return 0;
    }
  }

  private async createCashbackRecord(receiptId: number, customerId: number, promotionId: string, amount: number) {
    try {
      await this.prisma.cashback.create({
        data: {
          receiptId,
          customerId,
          promotionId,
          amount,
          status: 'awarded',
        },
      });
    } catch (error) {
      this.logger.error('Error creating cashback record:', error);
    }
  }


} 