import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FnsAuthService } from './fns-auth.service';
import { FnsCheckService } from './fns-check.service';
import { FnsQueueService } from './fns-queue.service';
import { FnsCashbackService } from './fns-cashback.service';
import { PrismaService } from '../prisma.service';
import { VerifyReceiptDto } from './dto/verify-receipt.dto';
import { ReceiptStatusDto } from './dto/receipt-status.dto';

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
    
    if (status === 'success') {
      // Получаем данные запроса для извлечения networkId
      const request = await this.prisma.fnsRequest.findUnique({
        where: { id: requestId },
        select: { qrData: true },
      });

      const networkId = request?.qrData?.networkId;
      const cashbackAmount = await this.fnsCashbackService.calculateCashback(result.receiptData, customerId, networkId);
      
      if (customerId && cashbackAmount > 0) {
        await this.fnsCashbackService.awardCashbackToCustomer(customerId, cashbackAmount);
      }
      
      await this.fnsQueueService.updateRequestStatus(requestId, 'success', {
        cashbackAmount,
        cashbackAwarded: cashbackAmount > 0,
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

  async getRequestByQrData(qrData: any, customerId: number): Promise<any> {
    try {
      const request = await this.prisma.fnsRequest.findFirst({
        where: {
          customerId,
          qrData: {
            path: ['fn'],
            equals: qrData.fn,
          },
          // Дополнительные проверки для уникальности чека
          AND: [
            {
              qrData: {
                path: ['fd'],
                equals: qrData.fd,
              },
            },
            {
              qrData: {
                path: ['fp'],
                equals: qrData.fp,
              },
            },
          ],
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return request;
    } catch (error) {
      this.logger.error('Error finding existing request:', error);
      return null;
    }
  }
} 