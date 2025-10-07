import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CashbackStatus } from '@prisma/client';

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
  cashbackRate?: number;
  productId?: number;
  offerId?: number;
  offerName?: string;
}

export interface ReceiptItem {
  name: string;
  sku?: string;
  price: number;
  quantity: number;
  total: number;
}

@Injectable()
export class CashbackService {
  private readonly logger = new Logger(CashbackService.name);

  constructor(private readonly prisma: PrismaService) {}

  async calculateCashback(
    receiptData: any,
    customerId: number,
    promotionId: string
  ): Promise<CashbackCalculationResult> {
    this.logger.log(`Calculating cashback for customer ${customerId}, promotion ${promotionId}`);

    try {
      const activeOffers = await this.getActiveOffers(promotionId);
      this.logger.log(`Found ${activeOffers.length} active offers`);

      const receiptItems = this.parseReceiptItems(receiptData);
      this.logger.log(`Parsed ${receiptItems.length} receipt items`);

      const result = await this.matchItemsWithOffersAndCalculate(receiptItems, activeOffers, promotionId);

      this.logger.log(`Calculated total cashback: ${result.totalCashback}`);
      return result;
    } catch (error) {
      this.logger.error('Error calculating cashback:', error);
      throw error;
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
        throw new NotFoundException('Cashback not found');
      }

      if (cashback.status === CashbackStatus.cancelled) {
        throw new BadRequestException('Cashback already cancelled');
      }

      if (cashback.customer.bonuses < cashback.amount) {
        throw new BadRequestException('Customer does not have enough bonuses to cancel this cashback');
      }

      await tx.cashback.update({
        where: { id: cashbackId },
        data: {
          status: CashbackStatus.cancelled,
          reason,
          cancelledBy: adminId,
          cancelledAt: new Date(),
        },
      });

      await tx.customer.update({
        where: { id: cashback.customerId },
        data: {
          bonuses: {
            decrement: cashback.amount,
          },
        },
      });

      if (cashback.fnsRequestId) {
        await tx.fnsRequest.update({
          where: { id: cashback.fnsRequestId },
          data: {
            cashbackAwarded: false,
          },
        });
      }

      this.logger.log(`Successfully cancelled cashback ${cashbackId}, refunded ${cashback.amount}`);
      return { success: true, refundedAmount: cashback.amount };
    });
  }

  async confirmCashback(
    cashbackId: number,
    adminId: number
  ): Promise<{ success: boolean; confirmedAmount: number }> {
    this.logger.log(`Confirming cashback ${cashbackId} by admin ${adminId}`);

    return await this.prisma.$transaction(async (tx) => {
      const cashback = await tx.cashback.findUnique({
        where: { id: cashbackId },
        include: { customer: true },
      });

      if (!cashback) {
        throw new NotFoundException('Cashback not found');
      }

      if (cashback.status === CashbackStatus.cancelled) {
        throw new BadRequestException('Cannot confirm cancelled cashback');
      }

      if (cashback.customer.bonuses < cashback.amount) {
        throw new BadRequestException('Customer does not have enough bonuses to confirm this cashback');
      }

      await tx.cashback.update({
        where: { id: cashbackId },
        data: {
          status: CashbackStatus.cancelled,
          reason: 'Подтвержден администратором',
          cancelledBy: adminId,
          cancelledAt: new Date(),
        },
      });

      await tx.customer.update({
        where: { id: cashback.customerId },
        data: {
          bonuses: {
            decrement: cashback.amount,
          },
        },
      });

      this.logger.log(`Successfully confirmed cashback ${cashbackId}, deducted ${cashback.amount}`);
      return { success: true, confirmedAmount: cashback.amount };
    });
  }

  async getTodaysCashbackHistory(promotionId?: string) {
    this.logger.log(`Getting today's cashback history for promotion: ${promotionId || 'all'}`);
    
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
      this.logger.log(`Filtering by promotion: ${promotionId}`);
    }

    const cashbacks = await this.prisma.cashback.findMany({
      where: whereClause,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            surname: true,
            email: true,
          },
        },
        promotion: {
          select: {
            promotionId: true,
            name: true,
          },
        },
        cancelledByAdmin: {
          select: {
            id: true,
            username: true,
          },
        },
        items: {
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    this.logger.log(`Found ${cashbacks.length} cashback records for today`);
    
    if (promotionId && cashbacks.length === 0) {
      const totalCashbacks = await this.prisma.cashback.count({
        where: { promotionId }
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
        promotion: {
          select: {
            promotionId: true,
            name: true,
            domain: true,
          },
        },
        products: {
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
        cashbacks: {
          select: {
            id: true,
            amount: true,
            status: true,
            createdAt: true,
            reason: true,
            cancelledAt: true,
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
        receipt: {
          select: {
            id: true,
            number: true,
            date: true,
            address: true,
            price: true,
          },
        },
        promotion: {
          select: {
            promotionId: true,
            name: true,
            domain: true,
          },
        },
        cancelledByAdmin: {
          select: {
            id: true,
            username: true,
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

    const statuses = cashbacks.map(cashback => ({
      id: cashback.id,
      amount: cashback.amount,
      status: cashback.status === 'active' ? 'начислен' : 'отменен',
      reason: cashback.reason,
      createdAt: cashback.createdAt,
      cancelledAt: cashback.cancelledAt,
      receipt: cashback.receipt,
      promotion: cashback.promotion,
      items: cashback.items,
    }));

    this.logger.log(`Retrieved ${statuses.length} cashback status records for customer ${customerId}`);
    
    return statuses;
  }

  
  async getCashbackDetails(cashbackId: number, customerId?: number) {
    const whereClause: any = { id: cashbackId };
    if (customerId) {
      whereClause.customerId = customerId;
    }

    const cashback = await this.prisma.cashback.findUnique({
      where: whereClause,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            surname: true,
            email: true,
          },
        },
        receipt: {
          include: {
            products: {
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
        },
        promotion: {
          select: {
            promotionId: true,
            name: true,
            domain: true,
          },
        },
        cancelledByAdmin: {
          select: {
            id: true,
            username: true,
          },
        },
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
      throw new NotFoundException('Cashback not found');
    }

    return cashback;
  }

  
  private async getActiveOffers(promotionId: string) {
    const now = new Date();
    
    this.logger.log(`Getting active offers for promotion ${promotionId} at ${now.toISOString()}`);
    
    const offers = await this.prisma.offer.findMany({
      where: {
        promotionId,
        date_from: { lte: now },
        date_to: { gte: now },
      },
      include: {
        products: {
          include: {
            product: {
              include: {
                brand: true,
              },
            },
          },
        },
        condition: true,
      },
      orderBy: {
        profit: 'desc', 
      },
    });

    this.logger.log(`Found ${offers.length} active offers for promotion ${promotionId}`);
    
    const validOffers = offers.filter(offer => {
      const hasProducts = offer.products && offer.products.length > 0;
      const hasValidProfit = offer.profit > 0;
      
      if (!hasProducts) {
        this.logger.warn(`Offer ${offer.id} has no products assigned`);
      }
      if (!hasValidProfit) {
        this.logger.warn(`Offer ${offer.id} has invalid profit: ${offer.profit}`);
      }
      
      return hasProducts && hasValidProfit;
    });

    this.logger.log(`${validOffers.length} valid offers after filtering`);
    
    validOffers.forEach(offer => {
      this.logger.debug(`Offer ${offer.id}: ${offer.profit}${offer.profitType === 'static' ? ' руб.' : '%'}, products: ${offer.products.length}, condition: ${offer.condition ? 'yes' : 'no'}`);
    });
    
    return validOffers;
  }

  
  private parseReceiptItems(receiptData: any): ReceiptItem[] {
    this.logger.log('Parsing receipt items from:', receiptData);
    
    const fnsItems = receiptData?.items || receiptData?.content?.items;
    if (fnsItems) {
      this.logger.log(`Parsing ${fnsItems.length} FNS items`);
      const parsedItems = fnsItems.map((item: any) => {
        const parsedItem = {
          name: this.normalizeProductName(item.name || item.productName || item.text || ''),
          sku: item.sku || item.productCode || item.code || null,
          price: this.parsePrice(item.price || item.sum || item.amount || 0),
          quantity: parseInt(item.quantity || item.qty || 1),
          total: this.parsePrice(item.sum || item.total || item.amount || 0),
        };
        
        this.logger.debug(`Parsed FNS item: original="${item.name}", normalized="${parsedItem.name}", price=${parsedItem.price}, total=${parsedItem.total}`);
        return parsedItem;
      });
      
      return parsedItems;
    }

    if (receiptData?.products) {
      this.logger.log(`Parsing ${receiptData.products.length} DB products`);
      return receiptData.products.map((receiptProduct: any) => {
        const product = receiptProduct.product;
        const totalPrice = receiptData.price || 1000;
        const itemCount = receiptData.products.length;
        const itemPrice = Math.round(totalPrice / itemCount);
        
        this.logger.log(`Product: ${product?.name}, itemPrice: ${itemPrice}`);
        
        return {
          name: this.normalizeProductName(product?.name || 'Unknown Product'),
          sku: product?.sku || null,
          price: itemPrice,
          quantity: 1,
          total: itemPrice,
        };
      });
    }

    const items = receiptData?.content?.items || receiptData?.document?.receipt?.items || [];
    this.logger.log(`Parsing ${items.length} fallback items`);
    
    return items.map((item: any) => ({
      name: this.normalizeProductName(item.name || item.productName || item.text || ''),
      sku: item.sku || item.productCode || item.code || null,
      price: this.parsePrice(item.price || item.sum || item.amount || 0),
      quantity: parseInt(item.quantity || item.qty || 1),
      total: this.parsePrice(item.sum || item.total || item.amount || 0),
    }));
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
    
    const matchingProduct = offer.products.find((productOffer: any) =>
      this.isProductMatch(receiptItem, productOffer.product)
    );

    if (!matchingProduct) {
      this.logger.debug(`Item "${receiptItem.name}" - no matching product in offer ${offer.id}`);
      return null;
    }

    this.logger.debug(`Item "${receiptItem.name}" matched with product "${matchingProduct.product.name}" (ID: ${matchingProduct.product.id})`);

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
      productId: matchingProduct.product.id,
      offerId: offer.id,
      offerName: `Акция: ${offer.profit}${offer.profitType === 'static' ? ' руб.' : '%'}`,
    };
  }



  
  private isProductMatch(receiptItem: ReceiptItem, product: any): boolean {
    if (receiptItem.sku && product.sku && receiptItem.sku === product.sku) {
      return true;
    }

    if (receiptItem.name && product.name) {
      const receiptName = this.normalizeProductName(receiptItem.name);
      const productName = this.normalizeProductName(product.name);
      
      if (receiptName === productName) {
        return true;
      }

      if (receiptName.includes(productName) || productName.includes(receiptName)) {
        return true;
      }

      const similarity = this.calculateNameSimilarity(receiptName, productName);
      if (similarity >= 0.6) {
        return true;
      }
    }

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
      return profit;
    } else if (profitType === 'from') {
      return Math.round((receiptItem.total * profit) / 100);
    }
    
    return 0;
  }

  
  private normalizeProductName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\u0400-\u04FFa-zA-Z0-9\s]/gi, '') 
      .replace(/\s+/g, ' ') 
      .trim();
  }


  private calculateNameSimilarity(name1: string, name2: string): number {
    const words1 = name1.split(' ');
    const words2 = name2.split(' ');
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
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
    
    let whereCondition: any = {
      name: {
        equals: name,
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
      whereCondition.name = {
        contains: normalizedName,
        mode: 'insensitive',
      };
      
      product = await this.prisma.product.findFirst({
        where: whereCondition,
        include: { brand: true },
      });
    }
    
    this.logger.debug(`Product search result: ${product ? `found ID=${product.id}, name="${product.name}"` : 'not found'}`);
    
    return product;
  }

  
  private parsePrice(price: any): number {
    if (typeof price === 'number') {
      return price;
    }
    
    if (typeof price === 'string') {
      const numericPrice = parseFloat(price.replace(/[^\d.,]/g, '').replace(',', '.'));
      return isNaN(numericPrice) ? 0 : Math.round(numericPrice * 100); 
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
}