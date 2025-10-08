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

  async findPromotionByDomain(domain: string) {
    return await this.prisma.promotion.findUnique({
      where: { domain },
    });
  }

  async processScanQrCode(qrData: ScanQrCodeDto, customerId: number, promotionId: string, host: string) {
    this.logger.log(`Processing QR scan for customer ${customerId}, promotion ${promotionId}, host: ${host}`);
    
    try { 
      const promotion = await this.prisma.promotion.findUnique({
        where: { promotionId },
      });

      if (!promotion) {
        throw new BadRequestException('Promotion not found');
      }

      this.logger.log(`Using promotion: ${promotion.name} (${promotionId}) for host: ${host}`);

      const isRepeatedScan = await this.checkForRepeatedScan(qrData, customerId, promotionId);
      
      // Проверяем только на повторное сканирование
      if (isRepeatedScan) {
        return {
          requestId: null,
          status: 'rejected',
          message: 'Данный чек уже был отсканирован ранее',
        };
      }

      // Проверяем лимиты кешбека, но не отклоняем запрос
      const canReceiveCashback = await this.fnsCashbackService.checkCashbackLimitsForPromotion(
        customerId, 
        qrData, 
        promotionId
      );
      
      this.logger.log(`Cashback eligibility: ${canReceiveCashback}`);

      // Проверяем дневной лимит, но не отклоняем запрос
      const dailyLimit = await this.checkDailyLimit(promotionId);
      this.logger.log(`Daily limit check: allowed=${dailyLimit.allowed}, current=${dailyLimit.current}, limit=${dailyLimit.limit}`);

      const requestId = await this.fnsQueueService.addToQueueWithPromotion(
        qrData, 
        customerId, 
        promotionId
      );
      
      // Определяем сообщение в зависимости от доступности кешбека
      let message = 'Receipt verification started';
      if (!canReceiveCashback) {
        message = 'Receipt accepted, but no cashback available';
      } else if (!dailyLimit.allowed) {
        message = 'Receipt accepted, but daily limit exceeded';
      }

      return {
        requestId,
        status: 'pending',
        message,
        network: promotion.name,
        cashbackEligible: canReceiveCashback && dailyLimit.allowed,
      };
    } catch (error) {
      this.logger.error('Error processing QR scan:', error);
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
    
    if (result.isFake) {
      this.logger.warn(`Request ${requestId}: Receipt is fake, no receipt record will be created`);
      
      if (fnsRequest?.promotionId && customerId) {
        await this.createAdminNotification(
          'fake_receipt',
          'Обнаружен поддельный чек',
          `Клиент попытался отсканировать поддельный чек. Request ID: ${requestId}`,
          fnsRequest.promotionId,
          customerId,
          requestId
        );
      }
      
      await this.fnsQueueService.updateRequestStatus(requestId, 'rejected', {
        isReturn: false,
        isFake: true,
        fnsResponse: result,
      });
      return;
    }

    if (result.isReturn) {
      this.logger.warn(`Request ${requestId}: Receipt is return operation, no cashback awarded`);
      await this.fnsQueueService.updateRequestStatus(requestId, 'rejected', {
        isReturn: true,
        isFake: false,
        fnsResponse: result,
      });
      return;
    }
    
    if (status === 'success' && result.isValid && !result.isReturn && !result.isFake) {
      const receiptInn = (result.receiptData?.inn || 
                         result.receiptData?.user?.inn || 
                         result.receiptData?.userInn ||
                         result.receiptData?.content?.inn ||
                         result.receiptData?.content?.userInn)?.toString().trim();

      let promotionInn: string | undefined;
      try {
        if (fnsRequest?.promotionId) {
          const promo = await this.prisma.promotion.findUnique({
            where: { promotionId: fnsRequest.promotionId },
            select: { inn: true, name: true },
          });
          promotionInn = promo?.inn?.toString().trim();
          this.logger.debug(`Promotion INN lookup: promotionId=${fnsRequest.promotionId}, name=${promo?.name}, inn=${promotionInn}`);
        }
      } catch (e) {
        this.logger.warn(`Failed to load promotion INN for promotionId=${fnsRequest?.promotionId}: ${e?.message || e}`);
      }

      this.logger.debug(`Receipt data structure: ${JSON.stringify({
        'receiptData.inn': result.receiptData?.inn,
        'receiptData.userInn': result.receiptData?.userInn,
        'receiptData.content.inn': result.receiptData?.content?.inn,
        'receiptData.content.userInn': result.receiptData?.content?.userInn,
        'receiptData.user': result.receiptData?.user,
        foundInn: receiptInn,
        promotionInn: promotionInn
      })}`);
      
      if (!receiptInn) {
        this.logger.warn(`Request ${requestId}: No INN found in receipt data`);
        await this.fnsQueueService.updateRequestStatus(requestId, 'rejected', {
          isReturn: false,
          isFake: false,
          fnsResponse: result,
          rejectionReason: 'NO_INN_IN_RECEIPT',
        });
        return;
      }
      
      if (promotionInn && receiptInn !== promotionInn) {
        this.logger.warn(`Request ${requestId}: INN mismatch. Receipt INN: ${receiptInn}, Promotion INN: ${promotionInn}`);
        
        if (fnsRequest?.promotionId && customerId) {
          await this.createAdminNotification(
            'suspicious_activity',
            'Чек с неправильным ИНН',
            `Клиент отсканировал чек из другой подсети. ИНН чека: ${receiptInn}, ожидаемый ИНН: ${promotionInn}. Request ID: ${requestId}`,
            fnsRequest.promotionId,
            customerId,
            requestId,
            { receiptInn, expectedInn: promotionInn, qrData: result.qrData }
          );
        }
        
        await this.fnsQueueService.updateRequestStatus(requestId, 'rejected', {
          isReturn: false,
          isFake: false,
          fnsResponse: result,
          rejectionReason: 'WRONG_PROMOTION_INN',
        });
        return;
      }
      
      this.logger.log(`Request ${requestId}: INN validated successfully (${receiptInn})`);
      
      let cashbackAmount = 0;
      let cashbackId = null;
      
      if (customerId && fnsRequest?.promotionId) {
        try {
          await this.validateCustomerForPromotion(customerId, fnsRequest.promotionId);
          
          const calculationResult = await this.cashbackService.calculateCashback(
            result.receiptData, 
            customerId, 
            fnsRequest.promotionId
          );
          
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
          
          // Создаем чек всегда, независимо от наличия кешбека
          const receiptRecord = await this.createReceiptRecord(
            result.receiptData, 
            customerId, 
            fnsRequest.promotionId, 
            calculationResult.totalCashback,
            calculationResult
          );
          
          this.logger.log(`Receipt record created for organization INN ${receiptInn}, amount: ${result.receiptData?.total || 'unknown'}, items: ${result.receiptData?.items?.length || 0}`);
          
          // Начисляем кешбек только если он есть
          if (calculationResult.totalCashback > 0) {
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
            this.logger.log(`No eligible items for cashback in request ${requestId}, but receipt was created`);
          }
        } catch (error) {
          this.logger.error(`Error awarding cashback for request ${requestId}:`, error);
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
    } else if (status === 'rejected') {
      this.logger.warn(`Request ${requestId} rejected: validation failed`);
      
      await this.fnsQueueService.updateRequestStatus(requestId, 'rejected', {
        isReturn: false,
        isFake: false,
        fnsResponse: result,
      });
    } else if (status === 'failed') {
      this.logger.warn(`Request ${requestId} failed: processing error`);
      await this.fnsQueueService.updateRequestStatus(requestId, 'failed', {
        isReturn: false,
        isFake: false,
        fnsResponse: result,
      });
    } else {
      this.logger.warn(`Request ${requestId} unknown status: ${status}`);
      await this.fnsQueueService.updateRequestStatus(requestId, status, {
        fnsResponse: result,
      });
    }
  }

  
  private checkForNegativeItems(receiptData: any): boolean {
    if (!receiptData) return false;
    
    if (receiptData.totalSum < 0 || receiptData.sum < 0 || receiptData.total < 0) {
      return true;
    }
    
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

  private extractPromotionIdFromHost(host: string): string | null {
    const parts = host.split('.');
    
    // Специальная обработка для Punycode доменов
    if (host.includes('xn----itbkgreg1a1b.xn--p1ai')) {
      // Для api.xn----itbkgreg1a1b.xn--p1ai не извлекаем promotionId
      // Это основной API домен
      return null;
    }
    
    if (parts.length >= 3) {
      const potentialPromotionId = parts[0];
      
      const standardSubdomains = ['www', 'api', 'admin', 'app', 'mobile', 'm'];
      if (!standardSubdomains.includes(potentialPromotionId)) {
        return potentialPromotionId;
      }
    }
    
    return null;
  }

  private isValidDomain(actualHost: string, expectedDomain: string, promotionId?: string): boolean {
    if (actualHost === expectedDomain) {
      return true;
    }
    
    if (actualHost.includes(expectedDomain)) {
      return true;
    }
    
    const expectedParts = expectedDomain.split('.');
    const actualParts = actualHost.split('.');
    
    if (expectedParts.length === 2) {
      const [expectedName, expectedTld] = expectedParts;
      const lastTwoParts = actualParts.slice(-2);
      
      if (lastTwoParts.length === 2 && 
          lastTwoParts[0] === expectedName && 
          lastTwoParts[1] === expectedTld) {
        return true;
      }
    }
    
    if (promotionId && actualParts.length >= 3) {
      const lastTwoParts = actualParts.slice(-2);
      const expectedParts = expectedDomain.split('.');
      
      if (expectedParts.length === 2) {
        const [expectedName, expectedTld] = expectedParts;
        
        if (actualParts[actualParts.length - 3] === promotionId &&
            lastTwoParts[0] === expectedName && 
            lastTwoParts[1] === expectedTld) {
          return true;
        }
      }
    }
    
    if (expectedDomain === 'чек-поинт.рф' || expectedDomain === 'xn----itbkgreg1a1b.xn--p1ai' || expectedDomain === '91.236.198.205:4000') {
      return actualHost.includes('xn----itbkgreg1a1b.xn--p1ai') || 
             actualHost.includes('чек-поинт.рф') ||
             actualHost.includes('91.236.198.205') ||
             actualHost.includes('api.xn----itbkgreg1a1b.xn--p1ai');
    }
    
    return false;
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
      
      const receiptDate = receiptData.dateTime || receiptData.content?.dateTime || receiptData.date || receiptData.content?.date;
      const fiscalNumber = receiptData.fiscalDocumentNumber || receiptData.content?.fiscalDocumentNumber || receiptData.fd;
      const totalSum = receiptData.totalSum || receiptData.content?.totalSum || receiptData.sum || receiptData.content?.sum;
      const address = receiptData.retailPlace || receiptData.content?.retailPlace || receiptData.retailPlaceAddress || receiptData.content?.retailPlaceAddress || receiptData.address || 'Неизвестно';
      
      let parsedDate: Date;
      if (receiptDate) {
        if (typeof receiptDate === 'number') {
          parsedDate = new Date(receiptDate * 1000);
          this.logger.debug(`Parsed date from timestamp: ${receiptDate} -> ${parsedDate.toISOString()}`);
        } else if (typeof receiptDate === 'string') {
          let dateString = receiptDate;
          
          if (receiptDate.includes('+') || receiptDate.includes('Z')) {
            dateString = receiptDate;
          } else {
            if (receiptDate.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)) {
              dateString = receiptDate + '+03:00';
            } else if (receiptDate.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
              dateString = receiptDate.replace(' ', 'T') + '+03:00';
            } else {
              dateString = receiptDate + 'Z';
            }
          }
          
          parsedDate = new Date(dateString);
          this.logger.debug(`Parsed date from string: "${receiptDate}" -> "${dateString}" -> ${parsedDate.toISOString()}`);
        } else {
          parsedDate = new Date(receiptDate);
          this.logger.debug(`Parsed date from other type: ${receiptDate} -> ${parsedDate.toISOString()}`);
        }
      } else {
        parsedDate = new Date();
        this.logger.debug(`No receipt date provided, using current time: ${parsedDate.toISOString()}`);
      }
      
      const receipt = await this.prisma.receipt.create({
        data: {
          date: parsedDate,
          number: parseInt(fiscalNumber) || 0,
          price: parseInt(totalSum) || 0,
          cashback,
          status: 'success',
          address,
          promotionId,
          customerId,
        },
      });

      const receiptItems = this.parseReceiptItemsFromFns(receiptData);
      const receiptProducts = await Promise.all(
        receiptItems.map(async (fnsItem: any, index: number) => {
          try {
            const matchedProduct = await this.findProductInDatabase(fnsItem, promotionId);
            const matchedOffer = calculationResult?.items?.[index]?.offerId;
            const itemCashback = calculationResult?.items?.[index]?.cashbackAmount || 0;

            return await this.prisma.receiptProduct.create({
              data: {
                receiptId: receipt.id,
                productId: matchedProduct?.id || null, 
                offerId: matchedOffer || null,
                cashback: itemCashback,
                fnsProductName: fnsItem.name,
                fnsProductPrice: fnsItem.price,
                fnsProductQuantity: fnsItem.quantity,
                fnsProductSum: fnsItem.sum,
              },
            });
          } catch (error) {
            this.logger.error(`Error creating receipt product for FNS item ${fnsItem.name}:`, error);
            
            try {
              return await this.prisma.receiptProduct.create({
                data: {
                  receiptId: receipt.id,
                  productId: null,
                  offerId: null,
                  cashback: 0,
                  fnsProductName: fnsItem.name,
                  fnsProductPrice: fnsItem.price,
                  fnsProductQuantity: fnsItem.quantity,
                  fnsProductSum: fnsItem.sum,
                },
              });
            } catch (fallbackError) {
              this.logger.error(`Failed to create receipt product even as fallback:`, fallbackError);
              return null;
            }
          }
        })
      );

      const successfulProducts = receiptProducts.filter(p => p !== null);
      this.logger.log(`Created ${successfulProducts.length} receipt product records for receipt ${receipt.id}`);
      
      const matchedProducts = successfulProducts.filter(p => p.productId !== null).length;
      const unmatchedProducts = successfulProducts.length - matchedProducts;
      
      if (unmatchedProducts > 0) {
        this.logger.warn(`${unmatchedProducts} products from FNS receipt could not be matched with local database for promotion ${promotionId}`);
      }

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

  
  private parseReceiptItemsFromFns(receiptData: any): any[] {
    const items = receiptData?.items || receiptData?.content?.items || receiptData?.products || receiptData?.document?.receipt?.items || [];
    
    return items.map((item: any) => ({
      name: item.name || item.productName || item.text || '',
      price: this.parsePrice(item.price || item.sum || item.amount || 0),
      quantity: parseFloat(item.quantity || item.qty || 1),
      sum: this.parsePrice(item.sum || item.total || item.amount || 0),
      nds: item.nds || item.vat || null,
      ndsSum: this.parsePrice(item.ndsSum || item.vatSum || 0),
      paymentType: item.paymentType || null,
      productType: item.productType || null,
    }));
  }

  
  private async findProductInDatabase(fnsItem: any, promotionId: string): Promise<any | null> {
    try {
      this.logger.debug(`Searching for product in database: ${fnsItem.name}`);
      
      const normalizedName = this.normalizeProductName(fnsItem.name);
      
      let product = await this.prisma.product.findFirst({
        where: {
          promotionId,
          name: {
            equals: fnsItem.name,
            mode: 'insensitive',
          },
        },
        include: {
          brand: true,
        },
      });

      if (!product) {
        product = await this.prisma.product.findFirst({
          where: {
            promotionId,
            name: {
              contains: normalizedName,
              mode: 'insensitive',
            },
          },
          include: {
            brand: true,
          },
        });
      }

      if (!product && normalizedName.length > 3) {
        const keywords = normalizedName.split(' ').filter(word => word.length > 2);
        
        for (const keyword of keywords.slice(0, 3)) { 
          product = await this.prisma.product.findFirst({
            where: {
              promotionId,
              name: {
                contains: keyword,
                mode: 'insensitive',
              },
            },
            include: {
              brand: true,
            },
          });
          
          if (product) break;
        }
      }

      if (product) {
        this.logger.debug(`Found matching product: ${product.name} (ID: ${product.id})`);
      } else {
        this.logger.debug(`No matching product found for: ${fnsItem.name}`);
      }

      return product;
    } catch (error) {
      this.logger.error(`Error searching for product in database:`, error);
      return null;
    }
  }

 
  private normalizeProductName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/gi, '') 
      .replace(/\s+/g, ' ') 
      .trim();
  }

  
  private parsePrice(price: any): number {
    if (typeof price === 'number') {
      return price;
    }
    
    if (typeof price === 'string') {
      const numericPrice = parseFloat(price.replace(/[^\d.,]/g, '').replace(',', '.'));
      return isNaN(numericPrice) ? 0 : Math.round(numericPrice * 100); // Переводим в копейки
    }
    
    return 0;
  }

  
  private async createAdminNotification(
    type: 'suspicious_activity' | 'repeated_scan' | 'fake_receipt' | 'system_error',
    title: string,
    message: string,
    promotionId: string,
    customerId?: number,
    fnsRequestId?: string,
    metadata?: any
  ) {
    try {
      await this.prisma.adminNotification.create({
        data: {
          type,
          title,
          message,
          promotionId,
          customerId,
          fnsRequestId,
          metadata,
        },
      });
      
      this.logger.log(`Created admin notification: ${title} for promotion ${promotionId}`);
    } catch (error) {
      this.logger.error('Error creating admin notification:', error);
    }
  }

  
  async checkForRepeatedScan(qrData: any, customerId: number, promotionId: string): Promise<boolean> {
    try {
      const existingRequest = await this.prisma.fnsRequest.findFirst({
        where: {
          qrData: {
            path: ['fn'],
            equals: qrData.fn,
          },
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
        select: {
          id: true,
          createdAt: true,
          status: true,
          customerId: true,
        },
      });

      if (existingRequest) {
        const isSameCustomer = existingRequest.customerId === customerId;
        const message = isSameCustomer 
          ? `Клиент ${customerId} повторно сканирует чек. Первое сканирование: ${existingRequest.createdAt.toISOString()}, статус: ${existingRequest.status}`
          : `Клиент ${customerId} пытается отсканировать чек, который уже был отсканирован клиентом ${existingRequest.customerId}. Первое сканирование: ${existingRequest.createdAt.toISOString()}, статус: ${existingRequest.status}`;
        
        await this.createAdminNotification(
          'repeated_scan',
          isSameCustomer ? 'Повторное сканирование чека' : 'Попытка сканирования уже использованного чека',
          message,
          promotionId,
          customerId,
          existingRequest.id,
          { originalRequestId: existingRequest.id, qrData, originalCustomerId: existingRequest.customerId }
        );
        
        return true; 
      }

      return false; 
    } catch (error) {
      this.logger.error('Error checking for repeated scan:', error);
      return false;
    }
  }

  
  private async validateCustomerForPromotion(customerId: number, promotionId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, promotionId: true, name: true, surname: true },
    });

    if (!customer) {
      throw new Error(`Customer ${customerId} not found`);
    }

    if (customer.promotionId !== promotionId) {
      this.logger.warn(`Customer ${customerId} belongs to promotion ${customer.promotionId}, but trying to scan receipt for promotion ${promotionId}`);
      throw new Error(
        `Клиент принадлежит к подсети ${customer.promotionId}, но пытается отсканировать чек для подсети ${promotionId}. Сканирование чеков возможно только в рамках вашей подсети.`
      );
    }

    this.logger.log(`Customer ${customerId} validation passed for promotion ${promotionId}`);
  }


} 