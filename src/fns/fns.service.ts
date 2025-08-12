import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FnsAuthService } from './fns-auth.service';
import { FnsCheckService } from './fns-check.service';
import { FnsQueueService } from './fns-queue.service';
import { FnsCashbackService } from './fns-cashback.service';
import { CashbackService } from '../cashback/cashback.service';
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
    private readonly cashbackService: CashbackService,
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
    
    this.logger.log(`Handling check result for request ${requestId}: status=${status}, isValid=${result.isValid}, isReturn=${result.isReturn}, isFake=${result.isFake}`);
    
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
    
    if (status === 'success' && result.isValid && !result.isReturn && !result.isFake) {
      // Начисляем кешбек только для валидных чеков покупки (не возврата)
      let cashbackAmount = 0;
      let cashbackId = null;
      
      if (customerId && fnsRequest?.promotionId) {
        try {
          // Используем новую систему кэшбека
          const calculationResult = await this.cashbackService.calculateCashback(
            result.receiptData, 
            customerId, 
            fnsRequest.promotionId
          );
          
          if (calculationResult.totalCashback > 0) {
            // Дополнительная проверка: убеждаемся что чек не содержит отрицательных сумм
            const hasNegativeItems = this.checkForNegativeItems(result.receiptData);
            if (hasNegativeItems) {
              this.logger.warn(`Request ${requestId}: Receipt contains negative items, treating as return`);
              await this.fnsQueueService.updateRequestStatus(requestId, 'rejected', {
                isReturn: true,
                isFake: false,
                fnsResponse: result,
              });
              return;
            }
            
            const receiptRecord = await this.createReceiptRecord(
              result.receiptData, 
              customerId, 
              fnsRequest.promotionId, 
              calculationResult.totalCashback,
              calculationResult
            );
            
            const awardResult = await this.cashbackService.awardCashback(
              customerId,
              requestId,
              receiptRecord?.id || null,
              fnsRequest.promotionId,
              calculationResult
            );
            
            cashbackAmount = awardResult.amount;
            cashbackId = awardResult.cashbackId;
            
            this.logger.log(`Awarded cashback ${cashbackAmount} to customer ${customerId} (cashback ID: ${cashbackId})`);
          } else {
            this.logger.log(`No eligible items for cashback in request ${requestId}`);
          }
        } catch (error) {
          this.logger.error(`Error awarding cashback for request ${requestId}:`, error);
          // Fallback to old system if new system fails
          cashbackAmount = await this.fnsCashbackService.calculateCashback(
            result.receiptData, 
            customerId, 
            fnsRequest.promotionId
          );
          
          if (cashbackAmount > 0) {
            await this.fnsCashbackService.awardCashbackToCustomer(customerId, cashbackAmount);
            await this.createReceiptRecord(result.receiptData, customerId, fnsRequest.promotionId, cashbackAmount, null);
          }
        }
      }
      
      await this.fnsQueueService.updateRequestStatus(requestId, 'success', {
        cashbackAmount,
        cashbackAwarded: cashbackAmount > 0,
        fnsResponse: result,
        isValid: true,
        isReturn: false,
        isFake: false,
      });
    } else if (status === 'rejected' || result.isReturn || result.isFake) {
      // Отклоняем чек если он возвратный или поддельный
      const rejectReason = result.isReturn ? 'return operation' : 
                          result.isFake ? 'fake receipt' : 'validation failed';
      this.logger.warn(`Request ${requestId} rejected: ${rejectReason}`);
      
      await this.fnsQueueService.updateRequestStatus(requestId, 'rejected', {
        isReturn: result.isReturn || false,
        isFake: result.isFake || false,
        fnsResponse: result,
      });
    } else if (status === 'failed') {
      this.logger.warn(`Request ${requestId} failed: processing error`);
      await this.fnsQueueService.updateRequestStatus(requestId, 'failed', {
        isReturn: false,
        isFake: true,
        fnsResponse: result,
      });
    } else {
      this.logger.warn(`Request ${requestId} unknown status: ${status}`);
      await this.fnsQueueService.updateRequestStatus(requestId, status, {
        fnsResponse: result,
      });
    }
  }

  /**
   * Проверяет наличие отрицательных сумм в чеке (индикатор возврата)
   */
  private checkForNegativeItems(receiptData: any): boolean {
    if (!receiptData) return false;
    
    // Проверяем общую сумму
    if (receiptData.totalSum < 0 || receiptData.sum < 0 || receiptData.total < 0) {
      return true;
    }
    
    // Проверяем позиции
    const items = receiptData.items || receiptData.products || [];
    return items.some((item: any) => 
      (item.price && item.price < 0) || 
      (item.sum && item.sum < 0) || 
      (item.total && item.total < 0) ||
      (item.amount && item.amount < 0)
    );
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
    calculationResult?: any
  ): Promise<any> {
    try {
      this.logger.log(`Creating receipt record for customer ${customerId}, promotion ${promotionId}, cashback: ${cashback}`);
      
      // Создаем запись чека
      const receipt = await this.prisma.receipt.create({
        data: {
          date: new Date(receiptData.dateTime || receiptData.date),
          number: parseInt(receiptData.fiscalDocumentNumber || receiptData.fd),
          price: parseInt(receiptData.totalSum || receiptData.sum),
          cashback,
          status: 'success',
          address: receiptData.retailPlace || receiptData.retailPlaceAddress || 'Неизвестно',
          promotionId,
          customerId,
        },
      });

      // Создаем записи товаров из чека с детализацией кешбека
      if (calculationResult && calculationResult.items && calculationResult.items.length > 0) {
        const receiptProducts = await Promise.all(
          calculationResult.items.map(async (item: any) => {
            try {
              return await this.prisma.receiptProduct.create({
                data: {
                  receiptId: receipt.id,
                  productId: item.productId,
                  offerId: item.offerId,
                  cashback: item.cashbackAmount,
                },
              });
            } catch (error) {
              this.logger.error(`Error creating receipt product for item ${item.productName}:`, error);
              return null;
            }
          })
        );

        const successfulProducts = receiptProducts.filter(p => p !== null);
        this.logger.log(`Created ${successfulProducts.length} receipt product records for receipt ${receipt.id}`);
      }

      // Получаем полную информацию о созданном чеке
      const completeReceipt = await this.prisma.receipt.findUnique({
        where: { id: receipt.id },
        include: {
          products: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
              offer: {
                select: {
                  id: true,
                  profit: true,
                  profitType: true,
                },
              },
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              surname: true,
            },
          },
          promotion: {
            select: {
              promotionId: true,
              name: true,
            },
          },
        },
      });

      this.logger.log(`Created complete receipt record with ID: ${receipt.id}, products: ${completeReceipt?.products?.length || 0}`);
      return completeReceipt;
    } catch (error) {
      this.logger.error('Error creating receipt record:', error);
      return null;
    }
  }


} 