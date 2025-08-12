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

  /**
   * Основной метод расчета кэшбека с учетом акций и товаров
   */
  async calculateCashback(
    receiptData: any,
    customerId: number,
    promotionId: string
  ): Promise<CashbackCalculationResult> {
    this.logger.log(`Calculating cashback for customer ${customerId}, promotion ${promotionId}`);

    try {
      // 1. Получаем активные акции для промоакции
      const activeOffers = await this.getActiveOffers(promotionId);
      this.logger.log(`Found ${activeOffers.length} active offers`);

      // 2. Парсим товары из чека
      const receiptItems = this.parseReceiptItems(receiptData);
      this.logger.log(`Parsed ${receiptItems.length} receipt items`);

      // 3. Сопоставляем товары с акциями и рассчитываем кэшбек
      const result = await this.matchItemsWithOffersAndCalculate(receiptItems, activeOffers);

      this.logger.log(`Calculated total cashback: ${result.totalCashback}`);
      return result;
    } catch (error) {
      this.logger.error('Error calculating cashback:', error);
      throw error;
    }
  }

  /**
   * Начисление кэшбека клиенту с созданием записи в истории
   */
  async awardCashback(
    customerId: number,
    fnsRequestId: string,
    receiptId: number | null,
    promotionId: string,
    calculationResult: CashbackCalculationResult
  ): Promise<{ cashbackId: number; amount: number }> {
    this.logger.log(`Awarding cashback ${calculationResult.totalCashback} to customer ${customerId}`);

    return await this.prisma.$transaction(async (tx) => {
      // 1. Создаем запись кэшбека
      const cashback = await tx.cashback.create({
        data: {
          customerId,
          receiptId,
          fnsRequestId,
          promotionId,
          amount: calculationResult.totalCashback,
          status: CashbackStatus.active,
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

      // 2. Начисляем бонусы клиенту
      await tx.customer.update({
        where: { id: customerId },
        data: {
          bonuses: {
            increment: calculationResult.totalCashback,
          },
        },
      });

      // 3. Обновляем статус FnsRequest
      await tx.fnsRequest.update({
        where: { id: fnsRequestId },
        data: {
          cashbackAmount: calculationResult.totalCashback,
          cashbackAwarded: true,
        },
      });

      this.logger.log(`Successfully awarded cashback ${calculationResult.totalCashback} to customer ${customerId}`);
      return { cashbackId: cashback.id, amount: calculationResult.totalCashback };
    });
  }

  /**
   * Отмена начисления кэшбека администратором
   */
  async cancelCashback(
    cashbackId: number,
    adminId: number,
    reason: string
  ): Promise<{ success: boolean; refundedAmount: number }> {
    this.logger.log(`Cancelling cashback ${cashbackId} by admin ${adminId}`);

    return await this.prisma.$transaction(async (tx) => {
      // 1. Проверяем существование и статус кэшбека
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

      // 2. Проверяем, достаточно ли бонусов у клиента для отмены
      if (cashback.customer.bonuses < cashback.amount) {
        throw new BadRequestException('Customer does not have enough bonuses to cancel this cashback');
      }

      // 3. Отменяем кэшбек
      await tx.cashback.update({
        where: { id: cashbackId },
        data: {
          status: CashbackStatus.cancelled,
          reason,
          cancelledBy: adminId,
          cancelledAt: new Date(),
        },
      });

      // 4. Списываем бонусы у клиента
      await tx.customer.update({
        where: { id: cashback.customerId },
        data: {
          bonuses: {
            decrement: cashback.amount,
          },
        },
      });

      // 5. Обновляем FnsRequest если есть
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

  /**
   * Получение истории кэшбека для администратора (за текущий день)
   */
  async getTodaysCashbackHistory(promotionId?: string) {
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

    return await this.prisma.cashback.findMany({
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
  }

  /**
   * Получение истории кешбека для клиента
   */
  async getCustomerCashbackHistory(customerId: number, promotionId?: string) {
    this.logger.log(`Getting cashback history for customer ${customerId}, promotion: ${promotionId}`);
    
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
        fnsRequest: {
          select: {
            id: true,
            status: true,
            createdAt: true,
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

    this.logger.log(`Retrieved ${cashbacks.length} cashback records for customer ${customerId}`);
    
    // Группируем по статусу для статистики
    const statistics = {
      total: cashbacks.length,
      active: cashbacks.filter(c => c.status === 'active').length,
      cancelled: cashbacks.filter(c => c.status === 'cancelled').length,
      totalAmount: cashbacks.filter(c => c.status === 'active').reduce((sum, c) => sum + c.amount, 0),
      cancelledAmount: cashbacks.filter(c => c.status === 'cancelled').reduce((sum, c) => sum + c.amount, 0),
    };

    return {
      cashbacks,
      statistics,
    };
  }

  /**
   * Получение детальной информации о конкретном кешбеке
   */
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

  /**
   * Получение активных акций для промоакции
   */
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
        profit: 'desc', // Приоритет более выгодным акциям
      },
    });

    this.logger.log(`Found ${offers.length} active offers for promotion ${promotionId}`);
    
    // Фильтруем акции, у которых есть товары
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
    
    // Логируем детали акций для отладки
    validOffers.forEach(offer => {
      this.logger.debug(`Offer ${offer.id}: ${offer.profit}${offer.profitType === 'static' ? ' руб.' : '%'}, products: ${offer.products.length}, condition: ${offer.condition ? 'yes' : 'no'}`);
    });
    
    return validOffers;
  }

  /**
   * Парсинг товаров из чека
   */
  private parseReceiptItems(receiptData: any): ReceiptItem[] {
    const items = receiptData?.items || receiptData?.products || receiptData?.document?.receipt?.items || [];
    
    return items.map((item: any) => ({
      name: this.normalizeProductName(item.name || item.productName || item.text || ''),
      sku: item.sku || item.productCode || item.code || null,
      price: this.parsePrice(item.price || item.sum || item.amount || 0),
      quantity: parseInt(item.quantity || item.qty || 1),
      total: this.parsePrice(item.sum || item.total || item.amount || 0),
    }));
  }

  /**
   * Сопоставление товаров с акциями и расчет кэшбека
   */
  private async matchItemsWithOffersAndCalculate(
    receiptItems: ReceiptItem[],
    activeOffers: any[]
  ): Promise<CashbackCalculationResult> {
    const result: CashbackCalculationResult = {
      totalCashback: 0,
      items: [],
      appliedOffers: [],
    };

    for (const receiptItem of receiptItems) {
      let bestCashback = 0;
      let bestMatch: CashbackItemCalculation | null = null;

      // Проверяем каждую активную акцию
      for (const offer of activeOffers) {
        const matchResult = await this.tryMatchItemWithOffer(receiptItem, offer);
        
        if (matchResult && matchResult.cashbackAmount > bestCashback) {
          bestCashback = matchResult.cashbackAmount;
          bestMatch = matchResult;
        }
      }

      // ВАЖНО: Кешбек начисляется ТОЛЬКО за товары, участвующие в акциях
      // Убираем проверку фиксированного кешбека товаров без акций
      // Согласно требованиям: "кешбек должен начисляться только за те товары, которые входили в какие либо акции"

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

  /**
   * Попытка сопоставить товар с акцией
   */
  private async tryMatchItemWithOffer(
    receiptItem: ReceiptItem,
    offer: any
  ): Promise<CashbackItemCalculation | null> {
    this.logger.debug(`Trying to match item "${receiptItem.name}" with offer ${offer.id} (${offer.profit}${offer.profitType === 'static' ? ' руб.' : '%'})`);
    
    // Проверяем, подходит ли товар под акцию
    const matchingProduct = offer.products.find((productOffer: any) =>
      this.isProductMatch(receiptItem, productOffer.product)
    );

    if (!matchingProduct) {
      this.logger.debug(`Item "${receiptItem.name}" - no matching product in offer ${offer.id}`);
      return null;
    }

    this.logger.debug(`Item "${receiptItem.name}" matched with product "${matchingProduct.product.name}" (ID: ${matchingProduct.product.id})`);

    // Проверяем условия акции
    if (offer.condition && !this.checkOfferCondition(receiptItem, offer.condition)) {
      this.logger.debug(`Item "${receiptItem.name}" - offer condition not met for offer ${offer.id}`);
      return null;
    }

    // Рассчитываем кэшбек
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

  /**
   * Попытка найти фиксированный кэшбек товара
   */
  private async tryMatchWithProductCashback(
    receiptItem: ReceiptItem
  ): Promise<CashbackItemCalculation | null> {
    // Ищем товар по SKU или названию
    const product = await this.findProductBySku(receiptItem.sku) || 
                   await this.findProductByName(receiptItem.name);

    if (!product || !product.fixCashback || !product.cashbackType) {
      return null;
    }

    const cashbackAmount = product.cashbackType === 'amount' 
      ? product.fixCashback 
      : Math.round((receiptItem.total * product.fixCashback) / 100);

    return {
      productName: receiptItem.name,
      productSku: receiptItem.sku,
      quantity: receiptItem.quantity,
      itemPrice: receiptItem.price,
      totalPrice: receiptItem.total,
      cashbackAmount,
      cashbackType: product.cashbackType,
      cashbackRate: product.fixCashback,
      productId: product.id,
    };
  }

  /**
   * Проверка соответствия товара продукту
   */
  private isProductMatch(receiptItem: ReceiptItem, product: any): boolean {
    // Точное соответствие по SKU
    if (receiptItem.sku && product.sku && receiptItem.sku === product.sku) {
      return true;
    }

    // Поиск по названию (нечеткое соответствие)
    if (receiptItem.name && product.name) {
      const receiptName = this.normalizeProductName(receiptItem.name);
      const productName = this.normalizeProductName(product.name);
      
      // Точное совпадение
      if (receiptName === productName) {
        return true;
      }

      // Частичное совпадение (один содержит другой)
      if (receiptName.includes(productName) || productName.includes(receiptName)) {
        return true;
      }

      // Совпадение ключевых слов (минимум 60% общих слов)
      const similarity = this.calculateNameSimilarity(receiptName, productName);
      if (similarity >= 0.6) {
        return true;
      }
    }

    return false;
  }

  /**
   * Проверка условий акции
   */
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

  /**
   * Расчет кэшбека по акции
   */
  private calculateOfferCashback(receiptItem: ReceiptItem, offer: any): number {
    const { profit, profitType } = offer;
    
    if (profitType === 'static') {
      return profit;
    } else if (profitType === 'from') {
      return Math.round((receiptItem.total * profit) / 100);
    }
    
    return 0;
  }

  /**
   * Нормализация названия товара
   */
  private normalizeProductName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/gi, '') // Убираем знаки препинания
      .replace(/\s+/g, ' ') // Заменяем множественные пробелы одним
      .trim();
  }

  /**
   * Расчет схожести названий товаров
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const words1 = name1.split(' ');
    const words2 = name2.split(' ');
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  /**
   * Поиск товара по SKU
   */
  private async findProductBySku(sku?: string) {
    if (!sku) return null;
    
    return await this.prisma.product.findFirst({
      where: { sku },
      include: { brand: true },
    });
  }

  /**
   * Поиск товара по названию
   */
  private async findProductByName(name: string) {
    const normalizedName = this.normalizeProductName(name);
    
    return await this.prisma.product.findFirst({
      where: {
        name: {
          contains: normalizedName,
          mode: 'insensitive',
        },
      },
      include: { brand: true },
    });
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
}