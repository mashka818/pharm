import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface CashbackCalculationResult {
  totalCashback: number;
  items: CashbackItemCalculation[];
  appliedOffers: number[];
}

export interface CashbackItemCalculation {
  productName: string;
  productSku?: string;
  quantity: number;
  itemPrice: number;
  totalPrice: number;
  cashbackAmount: number;
  cashbackType: 'percent' | 'amount';
  cashbackRate: number;
  productId?: number;
  offerId?: number;
  offerName?: string;
}

export interface ReceiptItem {
  name: string;
  sku?: string;
  quantity: number;
  price: number;
  total: number;
}

@Injectable()
export class CashbackService {
  private readonly logger = new Logger(CashbackService.name)

  constructor(private readonly prisma: PrismaService) {}

  async calculateCashback(
    receiptData: any,
    customerId: number,
    promotionId: string
  ): Promise<CashbackCalculationResult> {
    this.logger.log(`Calculating cashback for customer ${customerId}, promotion ${promotionId}`);

    try {
      this.logger.debug(`Receipt data structure: items=${JSON.stringify(receiptData.items)}, content.items=${JSON.stringify(receiptData.content?.items)}`);
      
      const items = receiptData.content?.items || receiptData.items || [];
      this.logger.debug(`Using items from: ${receiptData.content?.items ? 'receiptData.content.items' : 'receiptData.items'}, count: ${items.length}`);
      
      const receiptItems: ReceiptItem[] = items.map((item: any) => ({
        name: item.name || '',
        sku: item.sku,
        quantity: item.quantity || 1,
        price: this.parsePrice(item.price),
        total: this.parsePrice(item.sum),
      }));
      
      this.logger.debug(`Parsed receipt items: ${JSON.stringify(receiptItems)}`);

      const activeOffers = await this.getActiveOffers(promotionId);
      
      if (activeOffers.length === 0) {
        this.logger.log(`No active offers found for promotion ${promotionId}`);
        return {
          totalCashback: 0,
          items: [],
          appliedOffers: [],
        };
      }

      return await this.matchItemsWithOffersAndCalculate(receiptItems, activeOffers, promotionId);
    } catch (error) {
      this.logger.error('Error calculating cashback:', error);
      return {
        totalCashback: 0,
        items: [],
        appliedOffers: [],
      };
    }
  }

  async awardCashback(
    customerId: number,
    fnsRequestId: string | null,
    receiptId: number | null,
    promotionId: string,
    calculationResult: CashbackCalculationResult
  ): Promise<{ cashbackId: number; amount: number }> {
    this.logger.log(`Awarding cashback ${calculationResult.totalCashback} to customer ${customerId}`);

    return await this.prisma.$transaction(async (tx) => {
      const cashback = await tx.cashback.create({
        data: {
          customerId,
          receiptId,
          fnsRequestId,
          promotionId,
          amount: calculationResult.totalCashback,
          items: {
            create: calculationResult.items.map(item => ({
              productId: item.productId,
              offerId: item.offerId,
              productName: item.productName,
              productSku: item.productSku,
              quantity: item.quantity,
              itemPrice: item.itemPrice,
              totalPrice: item.totalPrice,
              cashbackAmount: item.cashbackAmount,
              cashbackType: item.cashbackType,
              cashbackRate: item.cashbackRate,
            })),
          },
        },
      });

      await tx.customer.update({
        where: { id: customerId },
        data: {
          bonuses: {
            increment: calculationResult.totalCashback,
          },
        },
      });

      if (fnsRequestId) {
        await tx.fnsRequest.update({
          where: { id: fnsRequestId },
          data: {
            cashbackAmount: calculationResult.totalCashback,
            cashbackAwarded: true,
          },
        });
      }

      this.logger.log(`Successfully awarded cashback ${calculationResult.totalCashback} to customer ${customerId}`);
      return { cashbackId: cashback.id, amount: calculationResult.totalCashback };
    });
  }

  async cancelCashback(
    cashbackId: number,
    adminId: number,
    reason: string
  ): Promise<{ success: boolean; refundedAmount: number }> {
    this.logger.log(`Cancelling cashback ${cashbackId} by admin ${adminId}`);

    return await this.prisma.$transaction(async (tx) => {
      const cashback = await tx.cashback.findUnique({
        where: { id: cashbackId },
        include: { customer: true },
      });

      if (!cashback) {
        throw new NotFoundException('Кешбек не найден');
      }

      if (false) {
        throw new BadRequestException('Кешбек уже отменен');
      }

      // В новой логике кешбеки не отменяются, они просто начисляются
      // Удаляем кешбек из базы данных
      await tx.cashback.delete({
        where: { id: cashbackId },
      });

      await tx.customer.update({
        where: { id: cashback.customerId },
        data: {
          bonuses: {
            decrement: cashback.amount,
          },
        },
      });

      this.logger.log(`Successfully cancelled cashback ${cashbackId}, refunded ${cashback.amount} bonuses`);
      return { success: true, refundedAmount: cashback.amount };
    });
  }

  async getTodaysCashbackHistory(promotionId?: string): Promise<any[]> {
    this.logger.log(`Getting today's cashback history for promotion: ${promotionId}`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const whereClause: any = {
      createdAt: {
        gte: today,
        lt: tomorrow,
      },
    };

    if (promotionId) {
      whereClause.promotionId = promotionId;
    }

    const cashbacks = await this.prisma.cashback.findMany({
      where: whereClause,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        promotion: {
          select: {
            promotionId: true,
            name: true,
            domain: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                brand: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    this.logger.log(`Retrieved ${cashbacks.length} cashback records for today`);

    if (promotionId && cashbacks.length === 0) {
      const totalCashbacks = await this.prisma.cashback.count({
        where: { promotionId },
      });
      this.logger.warn(`No cashbacks found for promotion ${promotionId} today, but found ${totalCashbacks} total cashbacks for this promotion`);
    }

    return cashbacks;
  }

  async getCustomerReceipts(customerId: number, promotionId?: string) {
    this.logger.log(`Getting receipts for customer ${customerId}, promotion: ${promotionId}`);
    
    const whereClause: any = {
      customerId,
    };

    if (promotionId) {
      whereClause.promotionId = promotionId;
    }

    const receipts = await this.prisma.receipt.findMany({
      where: whereClause,
      include: {
        cashbacks: {
          select: {
            id: true,
            amount: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    this.logger.log(`Retrieved ${receipts.length} receipt records for customer ${customerId}`);
    return receipts;
  }

  async getCustomerCashbackStatuses(customerId: number, promotionId?: string) {
    this.logger.log(`Getting cashback statuses for customer ${customerId}, promotion: ${promotionId}`);
    
    const whereClause: any = {
      customerId,
    };

    if (promotionId) {
      whereClause.promotionId = promotionId;
    }

    const cashbacks = await this.prisma.cashback.findMany({
      where: whereClause,
      include: {
        receipt: true,
        promotion: true,
        items: {
          include: {
            product: {
              include: {
                brand: true,
              },
            },
            offer: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const statuses = cashbacks.map(cashback => ({
      id: cashback.id,
      amount: cashback.amount,
      status: 'начислен',
      createdAt: cashback.createdAt,
      receipt: cashback.receipt,
      promotion: cashback.promotion,
      items: cashback.items,
    }));

    this.logger.log(`Retrieved ${statuses.length} cashback status records for customer ${customerId}`);
    
    return statuses;
  }

  private async getActiveOffers(promotionId: string): Promise<any[]> {
    const now = new Date();
    
    const offers = await this.prisma.offer.findMany({
      where: {
        promotionId,
        date_from: { lte: now },
        date_to: { gte: now },
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
    
    this.logger.debug(`Found ${offers.length} active offers for promotion ${promotionId}`);
    offers.forEach(offer => {
      this.logger.debug(`Offer ${offer.id}: ${offer.profit}${offer.profitType === 'static' ? ' руб.' : '%'}, products: ${JSON.stringify(offer.products || [])}`);
    });
    
    return offers;
  }

  private async matchItemsWithOffersAndCalculate(
    receiptItems: ReceiptItem[],
    activeOffers: any[],
    promotionId?: string
  ): Promise<CashbackCalculationResult> {
    const result: CashbackCalculationResult = {
      totalCashback: 0,
      items: [],
      appliedOffers: [],
    };

    for (const receiptItem of receiptItems) {
      let bestCashback = 0;
      let bestMatch: CashbackItemCalculation | null = null;

      for (const offer of activeOffers) {
        const matchResult = await this.tryMatchItemWithOffer(receiptItem, offer);
        
        if (matchResult && matchResult.cashbackAmount > bestCashback) {
          bestCashback = matchResult.cashbackAmount;
          bestMatch = matchResult;
        }
      }

      if (bestMatch) {
        result.items.push(bestMatch);
        result.totalCashback += bestMatch.cashbackAmount;
        
        if (bestMatch.offerId && !result.appliedOffers.includes(bestMatch.offerId)) {
          result.appliedOffers.push(bestMatch.offerId);
        }
        
        this.logger.log(`Item "${receiptItem.name}" matched with offer ${bestMatch.offerId}, cashback: ${bestMatch.cashbackAmount}`);
      } else {
        this.logger.log(`Item "${receiptItem.name}" - no active promotions, no cashback awarded`);
      }
    }

    this.logger.log(`Total items processed: ${receiptItems.length}, items with cashback: ${result.items.length}, total cashback: ${result.totalCashback}`);
    return result;
  }

  private async tryMatchItemWithOffer(
    receiptItem: ReceiptItem,
    offer: any
  ): Promise<CashbackItemCalculation | null> {
    this.logger.debug(`Trying to match item "${receiptItem.name}" with offer ${offer.id} (${offer.profit}${offer.profitType === 'static' ? ' руб.' : '%'})`);

    this.logger.debug(`Offer ${offer.id} has ${offer.products?.length || 0} products: ${JSON.stringify(offer.products || [])}`);
    
    const matchingProduct = offer.products.find((productOffer: any) => {
      const product = productOffer.product || productOffer;
      const isMatch = this.isProductMatch(receiptItem, product);
      this.logger.debug(`Comparing "${receiptItem.name}" with "${product.name}" (ID: ${product.id}): ${isMatch}`);
      return isMatch;
    });

    if (!matchingProduct) {
      this.logger.debug(`Item "${receiptItem.name}" - no matching product in offer ${offer.id}`);
      return null;
    }

    const product = matchingProduct.product || matchingProduct;
    this.logger.debug(`Item "${receiptItem.name}" matched with product "${product.name}" (ID: ${product.id})`);

    if (offer.condition && !this.checkOfferCondition(receiptItem, offer.condition)) {
      this.logger.debug(`Item "${receiptItem.name}" - offer condition not met for offer ${offer.id}`);        
      return null;
    }

    const cashbackAmount = this.calculateOfferCashback(receiptItem, offer);

    if (cashbackAmount <= 0) {
      this.logger.debug(`Item "${receiptItem.name}" - calculated cashback is 0 or negative`);
      return null;
    }

    this.logger.debug(`Item "${receiptItem.name}" - cashback calculated: ${cashbackAmount}`);

    return {
      productName: receiptItem.name,
      productSku: receiptItem.sku,
      quantity: receiptItem.quantity,
      itemPrice: receiptItem.price,
      totalPrice: receiptItem.total,
      cashbackAmount,
      cashbackType: offer.profitType === 'static' ? 'amount' : 'percent',
      cashbackRate: offer.profit,
      productId: product.id,
      offerId: offer.id,
      offerName: `Акция: ${offer.profit}${offer.profitType === 'static' ? ' руб.' : '%'}`,
    };
  }

  private isProductMatch(receiptItem: ReceiptItem, product: any): boolean {
    this.logger.debug(`isProductMatch: receiptItem.sku="${receiptItem.sku}", product.sku="${product.sku}"`);
    
    if (receiptItem.sku && product.sku && receiptItem.sku === product.sku) {
      this.logger.debug(`SKU match found: ${receiptItem.sku}`);
      return true;
    }

    if (receiptItem.name && product.name) {
      const receiptName = this.normalizeProductName(receiptItem.name);
      const productName = this.normalizeProductName(product.name);
      
      this.logger.debug(`Name comparison: receiptName="${receiptName}", productName="${productName}"`);
      
      if (receiptName === productName) {
        this.logger.debug(`Exact name match found`);
        return true;
      }

      const similarity = this.calculateNameSimilarity(receiptName, productName);
      this.logger.debug(`Name similarity: ${similarity} (threshold: 0.8)`);
      return similarity > 0.8;
    }

    this.logger.debug(`No match found`);
    return false;
  }

  private checkOfferCondition(receiptItem: ReceiptItem, condition: any): boolean {
    if (!condition) return true;

    const value = condition.variant === 'amount' ? receiptItem.quantity : receiptItem.total;

    switch (condition.type) {
      case 'from':
        return value >= condition.from_value;
      case 'to':
        return value <= condition.to_value;
      case 'from_to':
        return value >= condition.from_value && value <= condition.to_value;
      default:
        return true;
    }
  }

  private calculateOfferCashback(receiptItem: ReceiptItem, offer: any): number {
    const { profit, profitType } = offer;

    if (profitType === 'static') {
      return Math.round(profit * 100);
    } else {
      return Math.round((receiptItem.total * profit) / 100);
    }
  }

  private normalizeProductName(name: string): string {
    const normalized = name
      .toLowerCase()
      .replace(/[^\w\s\u0400-\u04FF]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    this.logger.debug(`normalizeProductName: "${name}" -> "${normalized}"`);
    return normalized;
  }

  private calculateNameSimilarity(name1: string, name2: string): number {
    const words1 = name1.split(' ');
    const words2 = name2.split(' ');
    
    let matches = 0;
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1 === word2 && word1.length > 2) {
          matches++;
          break;
        }
      }
    }
    
    const similarity = matches / Math.max(words1.length, words2.length);
    this.logger.debug(`calculateNameSimilarity: "${name1}" vs "${name2}" = ${similarity} (matches: ${matches}, words1: ${words1.length}, words2: ${words2.length})`);
    return similarity;
  }

  private async findProductBySku(sku?: string, promotionId?: string) {
    if (!sku) return null;

    const whereCondition: any = { sku };
    if (promotionId) {
      whereCondition.promotionId = promotionId;
    }

    return await this.prisma.product.findFirst({
      where: whereCondition,
      include: { brand: true },
    });
  }

  private async findProductByName(name: string, promotionId?: string) {
    const normalizedName = this.normalizeProductName(name);

    this.logger.debug(`Searching for product: original="${name}", normalized="${normalizedName}", promotionId=${promotionId}`);

    const whereCondition: any = {
      name: {
        contains: normalizedName,
        mode: 'insensitive',
      },
    };

    if (promotionId) {
      whereCondition.promotionId = promotionId;
    }

    let product = await this.prisma.product.findFirst({
      where: whereCondition,
      include: { brand: true },
    });

    if (!product) {
      this.logger.debug('Exact match not found, trying partial match');
      
      const words = normalizedName.split(' ');
      if (words.length > 1) {
        product = await this.prisma.product.findFirst({
          where: {
            ...whereCondition,
            name: {
              contains: words[0],
              mode: 'insensitive',
            },
          },
          include: { brand: true },
        });
      }
    }

    this.logger.debug(`Product search result: ${product ? `found ID=${product.id}, name="${product.name}"` : 'not found'}`);
    return product;
  }

  private parsePrice(price: any): number {
    if (typeof price === 'number') {
      return Math.round(price);
    }
    
    if (typeof price === 'string') {
      const numericPrice = parseFloat(price.replace(/[^\d.,]/g, '').replace(',', '.'));
      return isNaN(numericPrice) ? 0 : Math.round(numericPrice); 
    }
    
    return 0;
  }

  async getCustomerCashbackHistory(customerId: number): Promise<any[]> {
    return await this.prisma.cashback.findMany({
      where: {
        customerId: customerId,
      },
      include: {
        receipt: true,
        promotion: true,
        items: {
          include: {
            product: {
              include: {
                brand: true,
              },
            },
            offer: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async confirmCashback(cashbackId: number, adminId: number): Promise<{ success: boolean; confirmedAmount: number }> {
    this.logger.log(`Confirming cashback ${cashbackId} by admin ${adminId}`);

    const cashback = await this.prisma.cashback.findUnique({
      where: { id: cashbackId },
    });

    if (!cashback) {
      throw new NotFoundException('Кешбек не найден');
    }

    this.logger.log(`Cashback ${cashbackId} is already confirmed (bonuses already awarded)`);
    return { success: true, confirmedAmount: cashback.amount };
  }

  async getCashbackDetails(cashbackId: number, customerId: number): Promise<any> {
    this.logger.log(`Getting cashback details for ID ${cashbackId}, customer: ${customerId}`);

    const cashback = await this.prisma.cashback.findFirst({
      where: {
        id: cashbackId,
        customerId: customerId,
      },
      include: {
        receipt: true,
        promotion: true,
        items: {
          include: {
            product: {
              include: {
                brand: true,
              },
            },
            offer: true,
          },
        },
      },
    });

    if (!cashback) {
      throw new NotFoundException('Кешбек не найден');
    }

    return cashback;
  }
}