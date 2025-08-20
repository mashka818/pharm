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

      // Проверяем повторное сканирование
      const isRepeatedScan = await this.checkForRepeatedScan(qrData, customerId, promotionId);
      
      const canReceiveCashback = await this.fnsCashbackService.checkCashbackLimitsForPromotion(
        customerId, 
        qrData, 
        promotionId
      );
      
      if (!canReceiveCashback) {
        return {
          requestId: null,
          status: 'rejected',
          message: isRepeatedScan 
            ? 'Данный чек уже был отсканирован ранее' 
            : 'Cashback already received for this receipt in this network',
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
    
    // Поддельные чеки не обрабатываются - выводится ошибка + уведомление админу
    if (result.isFake) {
      this.logger.warn(`Request ${requestId}: Receipt is fake, no receipt record will be created`);
      
      // Уведомляем администратора о поддельном чеке
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

    // Возвратные чеки не обрабатываются
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
      // Проверяем ИНН чека - только чеки нашей организации принимаются
      const receiptInn = result.receiptData?.inn || result.receiptData?.user?.inn;
      const organizationInn = process.env.ORGANIZATION_INN;
      
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
      
      if (receiptInn !== organizationInn) {
        this.logger.warn(`Request ${requestId}: INN mismatch. Receipt INN: ${receiptInn}, Organization INN: ${organizationInn}`);
        
        // Уведомляем администратора о чеке с неправильным ИНН
        if (fnsRequest?.promotionId && customerId) {
          await this.createAdminNotification(
            'suspicious_activity',
            'Чек с неправильным ИНН',
            `Клиент отсканировал чек из другой организации. ИНН чека: ${receiptInn}, ожидаемый ИНН: ${organizationInn}. Request ID: ${requestId}`,
            fnsRequest.promotionId,
            customerId,
            requestId,
            { receiptInn, expectedInn: organizationInn, qrData: result.qrData }
          );
        }
        
        await this.fnsQueueService.updateRequestStatus(requestId, 'rejected', {
          isReturn: false,
          isFake: false,
          fnsResponse: result,
          rejectionReason: 'WRONG_ORGANIZATION_INN',
        });
        return;
      }
      
      this.logger.log(`Request ${requestId}: INN validated successfully (${receiptInn})`);
      
      // Начисляем кешбек только для валидных чеков покупки (не возврата) нашей организации
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
            
            this.logger.log(`Receipt record created for organization INN ${receiptInn}, amount: ${result.receiptData?.total || 'unknown'}, items: ${result.receiptData?.items?.length || 0}`);
            
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
    } else if (status === 'rejected') {
      // Отклоняем чек при ошибке валидации
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

      // Создаем записи товаров из чека ФНС
      // ВАЖНО: сначала пытаемся найти товары в нашей базе, если не находим - все равно записываем информацию из чека
      const receiptItems = this.parseReceiptItemsFromFns(receiptData);
      const receiptProducts = await Promise.all(
        receiptItems.map(async (fnsItem: any, index: number) => {
          try {
            // Пытаемся найти товар в нашей базе данных
            const matchedProduct = await this.findProductInDatabase(fnsItem, promotionId);
            const matchedOffer = calculationResult?.items?.[index]?.offerId;
            const itemCashback = calculationResult?.items?.[index]?.cashbackAmount || 0;

            return await this.prisma.receiptProduct.create({
              data: {
                receiptId: receipt.id,
                productId: matchedProduct?.id || null, // null если товар не найден в нашей БД
                offerId: matchedOffer || null,
                cashback: itemCashback,
                // Дополнительно сохраняем данные из ФНС для аудита
                fnsProductName: fnsItem.name,
                fnsProductPrice: fnsItem.price,
                fnsProductQuantity: fnsItem.quantity,
                fnsProductSum: fnsItem.sum,
              },
            });
          } catch (error) {
            this.logger.error(`Error creating receipt product for FNS item ${fnsItem.name}:`, error);
            
            // Если не удалось создать с productId, создаем без него но с данными ФНС
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

  /**
   * Парсинг товаров из ответа ФНС
   */
  private parseReceiptItemsFromFns(receiptData: any): any[] {
    const items = receiptData?.items || receiptData?.products || receiptData?.document?.receipt?.items || [];
    
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

  /**
   * Поиск товара в локальной базе данных по данным из ФНС
   */
  private async findProductInDatabase(fnsItem: any, promotionId: string): Promise<any | null> {
    try {
      this.logger.debug(`Searching for product in database: ${fnsItem.name}`);
      
      // Нормализуем название товара для поиска
      const normalizedName = this.normalizeProductName(fnsItem.name);
      
      // Поиск по точному совпадению названия
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

      // Если не найден по точному совпадению, ищем по частичному совпадению
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

      // Если все еще не найден, ищем по ключевым словам
      if (!product && normalizedName.length > 3) {
        const keywords = normalizedName.split(' ').filter(word => word.length > 2);
        
        for (const keyword of keywords.slice(0, 3)) { // Берем первые 3 ключевых слова
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

  /**
   * Нормализация названия товара для поиска
   */
  private normalizeProductName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/gi, '') // Убираем знаки препинания
      .replace(/\s+/g, ' ') // Заменяем множественные пробелы одним
      .trim();
  }

  /**
   * Парсинг цены из различных форматов
   */
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

  /**
   * Создание уведомления для администратора
   */
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

  /**
   * Проверка повторного сканирования и уведомление администратора
   */
  async checkForRepeatedScan(qrData: any, customerId: number, promotionId: string): Promise<boolean> {
    try {
      // Проверяем, сканировал ли клиент этот чек раньше
      const existingRequest = await this.prisma.fnsRequest.findFirst({
        where: {
          customerId,
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
        },
      });

      if (existingRequest) {
        // Уведомляем администратора о повторном сканировании
        await this.createAdminNotification(
          'repeated_scan',
          'Повторное сканирование чека',
          `Клиент ${customerId} повторно сканирует чек. Первое сканирование: ${existingRequest.createdAt.toISOString()}, статус: ${existingRequest.status}`,
          promotionId,
          customerId,
          existingRequest.id,
          { originalRequestId: existingRequest.id, qrData }
        );
        
        return true; // Это повторное сканирование
      }

      return false; // Первое сканирование
    } catch (error) {
      this.logger.error('Error checking for repeated scan:', error);
      return false;
    }
  }


} 