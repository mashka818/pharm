import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class FnsCashbackService {
  private readonly logger = new Logger(FnsCashbackService.name);

  constructor(private readonly prisma: PrismaService) {}

  async calculateCashback(receiptData: any, customerId?: number, networkId?: number): Promise<number> {
    this.logger.log(`Calculating cashback for receipt: ${JSON.stringify(receiptData)}`);

    try {
      // Если указана сеть, используем её для расчета кешбека
      if (networkId) {
        const network = await this.prisma.company.findUnique({
          where: { id: networkId },
          include: { promotion: true },
        });

        if (network) {
          const activeOffers = await this.getActiveOffersByPromotion(network.promotionId);
          const receiptItems = this.parseReceiptItems(receiptData);
          const cashbackItems = await this.matchItemsWithOffers(receiptItems, activeOffers);
          const totalCashback = this.calculateTotalCashback(cashbackItems);
          
          this.logger.log(`Calculated cashback for network ${networkId}: ${totalCashback}`);
          return totalCashback;
        }
      }

      // Fallback к общему расчету
      const activeOffers = await this.getActiveOffers();
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

  private async getActiveOffers(): Promise<any[]> {
    const now = new Date();
    
    return await this.prisma.offer.findMany({
      where: {
        date_from: {
          lte: now,
        },
        date_to: {
          gte: now,
        },
      },
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

  private async getActiveOffersByPromotion(promotionId: string): Promise<any[]> {
    const now = new Date();
    
    return await this.prisma.offer.findMany({
      where: {
        promotionId,
        date_from: {
          lte: now,
        },
        date_to: {
          gte: now,
        },
      },
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
    const existingRequest = await this.prisma.fnsRequest.findFirst({
      where: {
        customerId,
        qrData: {
          path: ['fn'],
          equals: receiptData.fn,
        },
        cashbackAwarded: true,
      },
    });

    if (existingRequest) {
      this.logger.warn(`Customer ${customerId} already received cashback for this receipt`);
      return false;
    }

    return true;
  }
} 