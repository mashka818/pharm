import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class FnsNetworkService {
  private readonly logger = new Logger(FnsNetworkService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getNetworkBySubdomain(subdomain: string): Promise<any> {
    this.logger.log(`Getting network for subdomain: ${subdomain}`);

    try {
      // Ищем сеть по поддомену
      const network = await this.prisma.company.findFirst({
        where: {
          subdomain: subdomain,
          role: 'PHARMACY_NETWORK',
        },
        include: {
          promotion: true,
        },
      });

      return network;
    } catch (error) {
      this.logger.error('Error getting network by subdomain:', error);
      return null;
    }
  }

  async getNetworkById(networkId: number): Promise<any> {
    this.logger.log(`Getting network by ID: ${networkId}`);

    try {
      const network = await this.prisma.company.findUnique({
        where: {
          id: networkId,
        },
        include: {
          promotion: true,
        },
      });

      return network;
    } catch (error) {
      this.logger.error('Error getting network by ID:', error);
      return null;
    }
  }

  async calculateNetworkCashback(networkId: number, receiptData: any): Promise<number> {
    this.logger.log(`Calculating cashback for network ${networkId}`);

    try {
      const network = await this.getNetworkById(networkId);
      if (!network) {
        this.logger.warn(`Network not found: ${networkId}`);
        return 0;
      }

      // Получаем активные предложения для сети
      const activeOffers = await this.prisma.offer.findMany({
        where: {
          promotionId: network.promotionId,
          date_from: {
            lte: new Date(),
          },
          date_to: {
            gte: new Date(),
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

      // Парсим товары из чека
      const receiptItems = this.parseReceiptItems(receiptData);
      
      // Сопоставляем товары с предложениями
      const cashbackItems = await this.matchItemsWithOffers(receiptItems, activeOffers);
      
      // Вычисляем общий кешбек
      const totalCashback = this.calculateTotalCashback(cashbackItems);
      
      this.logger.log(`Calculated cashback for network ${networkId}: ${totalCashback}`);
      return totalCashback;
    } catch (error) {
      this.logger.error('Error calculating network cashback:', error);
      return 0;
    }
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
    const itemTotal = item.total;
    
    if (offer.profitType === 'PERCENT') {
      return Math.round(itemTotal * (offer.profit / 100));
    } else {
      return offer.profit;
    }
  }

  private calculateTotalCashback(cashbackItems: any[]): number {
    return cashbackItems.reduce((total, item) => total + item.cashbackAmount, 0);
  }
}