import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class FnsCashbackService {
  private readonly logger = new Logger(FnsCashbackService.name);

  constructor(private readonly prisma: PrismaService) {}

  async calculateCashback(receiptData: any, customerId?: number, promotionId?: string): Promise<number> {
    this.logger.log(`Calculating cashback for receipt: ${JSON.stringify(receiptData)}, promotion: ${promotionId}`);

    try {
      const activeOffers = await this.getActiveOffers(promotionId);
      
      const receiptItems = this.parseReceiptItems(receiptData);
      
      const cashbackItems = await this.matchItemsWithOffers(receiptItems, activeOffers);
      
      const totalCashback = this.calculateTotalCashback(cashbackItems);
      
      this.logger.log(`Calculated cashback: ${totalCashback}`);
      return totalCashback;
    } catch (error) {
      this.logger.error('Error calculating cashback:', error);
      return 0;
    }
  }

  private async getActiveOffers(promotionId?: string): Promise<any[]> {
    const now = new Date();
    
    const whereClause: any = {
      date_from: {
        lte: now,
      },
      date_to: {
        gte: now,
      },
    };

    if (promotionId) {
      whereClause.promotionId = promotionId;
    }
    
    return await this.prisma.offer.findMany({
      where: whereClause,
      include: {
        products: {
          include: {
            product: true,
          },
        },
        condition: true,
      },
    });
  }

  private parseReceiptItems(receiptData: any): any[] {
    const items = receiptData?.items || receiptData?.products || [];
    
    return items.map((item: any) => ({
      name: item.name || item.productName,
      sku: item.sku || item.productCode,
      price: parseFloat(item.price || item.sum || 0),
      quantity: parseInt(item.quantity || 1),
      total: parseFloat(item.sum || item.total || 0),
    }));
  }

  private async matchItemsWithOffers(receiptItems: any[], activeOffers: any[]): Promise<any[]> {
    const cashbackItems = [];

    for (const item of receiptItems) {
      const matchingOffer = activeOffers.find(offer => 
        offer.products.some(productOffer => 
          this.matchProduct(item, productOffer.product)
        )
      );

      if (matchingOffer) {
        const cashbackAmount = this.calculateItemCashback(item, matchingOffer);
        cashbackItems.push({
          item,
          offer: matchingOffer,
          cashbackAmount,
        });
      }
    }

    return cashbackItems;
  }

  private matchProduct(receiptItem: any, product: any): boolean {
    if (receiptItem.sku && product.sku && receiptItem.sku === product.sku) {
      return true;
    }

    if (receiptItem.name && product.name) {
      const receiptName = receiptItem.name.toLowerCase();
      const productName = product.name.toLowerCase();
      
      if (receiptName.includes(productName) || productName.includes(receiptName)) {
        return true;
      }
    }

    return false;
  }

  private calculateItemCashback(item: any, offer: any): number {
    const { profit, profitType } = offer;
    
    if (profitType === 'static') {
      return profit;
    } else if (profitType === 'from') {
      return Math.round((item.total * profit) / 100);
    }
    
    return 0;
  }

  private calculateTotalCashback(cashbackItems: any[]): number {
    return cashbackItems.reduce((total, item) => total + item.cashbackAmount, 0);
  }

  async awardCashbackToCustomer(customerId: number, amount: number): Promise<void> {
    try {
      await this.prisma.customer.update({
        where: { id: customerId },
        data: {
          bonuses: {
            increment: amount,
          },
        },
      });

      this.logger.log(`Awarded ${amount} cashback to customer ${customerId}`);
    } catch (error) {
      this.logger.error(`Error awarding cashback to customer ${customerId}:`, error);
      throw error;
    }
  }

  async checkCashbackLimits(customerId: number, receiptData: any): Promise<boolean> {
    this.logger.log(`Checking global cashback limits for customer ${customerId}, receipt fn: ${receiptData.fn}`);
    
    try {
      // Проверяем, не обрабатывался ли уже этот чек пользователем
      const existingRequest = await this.prisma.fnsRequest.findFirst({
        where: {
          customerId,
          qrData: {
            path: ['fn'],
            equals: receiptData.fn,
          },
          AND: [
            {
              qrData: {
                path: ['fd'],
                equals: receiptData.fd,
              },
            },
            {
              qrData: {
                path: ['fp'],
                equals: receiptData.fp,
              },
            },
          ],
          OR: [
            { cashbackAwarded: true },
            { status: 'success' },
            { status: 'pending' },
            { status: 'processing' }
          ],
        },
        select: {
          id: true,
          cashbackAwarded: true,
          status: true,
          createdAt: true,
        },
      });

      if (existingRequest) {
        this.logger.warn(`Customer ${customerId} already processed this receipt. RequestId: ${existingRequest.id}, status: ${existingRequest.status}`);
        return false;
      }

      // Дополнительная проверка на подозрительную активность
      const recentRequests = await this.prisma.fnsRequest.count({
        where: {
          customerId,
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // последний час
          },
          OR: [
            { cashbackAwarded: true },
            { status: 'success' },
          ],
        },
      });

      // Лимит на количество успешных запросов в час
      const HOURLY_LIMIT = 5;
      if (recentRequests >= HOURLY_LIMIT) {
        this.logger.warn(`Customer ${customerId} exceeded hourly limit (${recentRequests}/${HOURLY_LIMIT})`);
        return false;
      }

      this.logger.log(`Global cashback limits check passed for customer ${customerId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error checking global cashback limits for customer ${customerId}:`, error);
      // В случае ошибки БД, блокируем для безопасности
      return false;
    }
  }

  async checkCashbackLimitsForPromotion(customerId: number, receiptData: any, promotionId: string): Promise<boolean> {
    this.logger.log(`Checking cashback limits for customer ${customerId}, promotion ${promotionId}, receipt fn: ${receiptData.fn}`);
    
    try {
      // Проверяем, не сканировал ли уже пользователь этот чек в ЛЮБОЙ сети
      const globalExistingRequest = await this.prisma.fnsRequest.findFirst({
        where: {
          customerId,
          qrData: {
            path: ['fn'],
            equals: receiptData.fn,
          },
          AND: [
            {
              qrData: {
                path: ['fd'],
                equals: receiptData.fd,
              },
            },
            {
              qrData: {
                path: ['fp'],
                equals: receiptData.fp,
              },
            },
          ],
          OR: [
            { cashbackAwarded: true },
            { status: 'success' },
            { status: 'pending' },
            { status: 'processing' }
          ],
        },
        select: {
          id: true,
          promotionId: true,
          cashbackAwarded: true,
          status: true,
          createdAt: true,
        },
      });

      if (globalExistingRequest) {
        this.logger.warn(`Customer ${customerId} already processed this receipt. RequestId: ${globalExistingRequest.id}, promotion: ${globalExistingRequest.promotionId}, status: ${globalExistingRequest.status}`);
        return false;
      }

      // Дополнительная проверка по сумме и дате для предотвращения мошенничества
      const recentSimilarRequest = await this.prisma.fnsRequest.findFirst({
        where: {
          customerId,
          qrData: {
            path: ['sum'],
            equals: receiptData.sum,
          },
          AND: [
            {
              qrData: {
                path: ['date'],
                equals: receiptData.date,
              },
            },
          ],
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // последний час
          },
          OR: [
            { cashbackAwarded: true },
            { status: 'success' },
            { status: 'pending' },
            { status: 'processing' }
          ],
        },
      });

      if (recentSimilarRequest) {
        this.logger.warn(`Customer ${customerId} recently processed similar receipt (same sum/date within 1 hour)`);
        return false;
      }

      // Проверяем дневной лимит кешбека для пользователя в конкретной промоакции
      const dailyLimit = await this.checkDailyCashbackLimit(customerId, promotionId);
      if (!dailyLimit) {
        this.logger.warn(`Customer ${customerId} exceeded daily cashback limit in promotion ${promotionId}`);
        return false;
      }

      this.logger.log(`Cashback limits check passed for customer ${customerId}, promotion ${promotionId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error checking cashback limits for customer ${customerId}, promotion ${promotionId}:`, error);
      // В случае ошибки БД, блокируем для безопасности
      return false;
    }
  }

  private async checkDailyCashbackLimit(customerId: number, promotionId: string): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let todaysRequests = 0;
    try {
      todaysRequests = await this.prisma.fnsRequest.count({
        where: {
          customerId,
          promotionId,
          cashbackAwarded: true,
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      });
    } catch (error) {
      if (error.message.includes('promotionId')) {
        todaysRequests = await this.prisma.fnsRequest.count({
          where: {
            customerId,
            cashbackAwarded: true,
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
    
    const DAILY_LIMIT = 10;
    return todaysRequests < DAILY_LIMIT;
  }
} 