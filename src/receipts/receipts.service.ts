import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';
import { PrismaService } from '../prisma.service';
import type { CashbackCalculationResult } from '../cashback/cashback.service';

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createReceiptDto: CreateReceiptDto) {
    this.logger.log(`Creating receipt with number: ${createReceiptDto.number}`);

    try {
      // Создаем чек
      const receipt = await this.prisma.receipt.create({
        data: {
          date: new Date(createReceiptDto.date),
          number: createReceiptDto.number,
          price: createReceiptDto.price,
          cashback: createReceiptDto.cashback,
          status: createReceiptDto.status,
          address: createReceiptDto.address,
          customerId: createReceiptDto.customerId,
          promotionId: createReceiptDto.promotionId,
        },
      });

      // Создаем продукты чека
      if (createReceiptDto.products && createReceiptDto.products.length > 0) {
        const receiptProducts = await Promise.all(
          createReceiptDto.products.map(product =>
            this.prisma.receiptProduct.create({
              data: {
                productId: product.productId,
                offerId: product.offerId,
                cashback: product.cashback,
                receiptId: receipt.id,
              },
            })
          )
        );

        this.logger.log(`Created ${receiptProducts.length} receipt products for receipt ${receipt.id}`);
      }

      // Возвращаем созданный чек с продуктами
      const createdReceipt = await this.prisma.receipt.findUnique({
        where: { id: receipt.id },
        include: {
          products: {
            include: {
              product: true,
              offer: true,
            },
          },
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
        },
      });

      this.logger.log(`Successfully created receipt ${receipt.id}`);
      return createdReceipt;
    } catch (error) {
      this.logger.error(`Error creating receipt:`, error);
      throw error;
    }
  }

  async getAll() {
    this.logger.log('Getting all receipts');
    
    try {
      const receipts = await this.prisma.receipt.findMany({
        include: {
          products: {
            include: {
              product: true,
              offer: true,
            },
          },
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
        },
        orderBy: {
          id: 'desc',
        },
      });

      this.logger.log(`Retrieved ${receipts.length} receipts`);
      return receipts;
    } catch (error) {
      this.logger.error('Error getting receipts:', error);
      throw error;
    }
  }

  async getOne(id: number) {
    this.logger.log(`Getting receipt with ID: ${id}`);
    
    try {
      const receipt = await this.prisma.receipt.findUnique({
        where: { id },
        include: {
          products: {
            include: {
              product: true,
              offer: true,
            },
          },
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
        },
      });

      if (!receipt) {
        throw new NotFoundException(`Receipt with ID ${id} not found`);
      }

      this.logger.log(`Retrieved receipt ${id}`);
      return receipt;
    } catch (error) {
      this.logger.error(`Error getting receipt ${id}:`, error);
      throw error;
    }
  }

  async update(updateReceiptDto: UpdateReceiptDto) {
    this.logger.log(`Updating receipt with ID: ${updateReceiptDto.id}`);
    
    try {
      // Проверяем, существует ли чек
      const existingReceipt = await this.prisma.receipt.findUnique({
        where: { id: updateReceiptDto.id },
      });

      if (!existingReceipt) {
        throw new NotFoundException(`Receipt with ID ${updateReceiptDto.id} not found`);
      }

      // Обновляем чек
      const updatedReceipt = await this.prisma.receipt.update({
        where: { id: updateReceiptDto.id },
        data: {
          date: updateReceiptDto.date ? new Date(updateReceiptDto.date) : undefined,
          number: updateReceiptDto.number,
          price: updateReceiptDto.price,
          cashback: updateReceiptDto.cashback,
          status: updateReceiptDto.status,
          address: updateReceiptDto.address,
          customerId: updateReceiptDto.customerId,
          promotionId: updateReceiptDto.promotionId,
        },
        include: {
          products: {
            include: {
              product: true,
              offer: true,
            },
          },
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
        },
      });

      this.logger.log(`Successfully updated receipt ${updateReceiptDto.id}`);
      return updatedReceipt;
    } catch (error) {
      this.logger.error(`Error updating receipt ${updateReceiptDto.id}:`, error);
      throw error;
    }
  }

  async remove(id: number) {
    this.logger.log(`Removing receipt with ID: ${id}`);
    
    try {
      // Проверяем, существует ли чек
      const existingReceipt = await this.prisma.receipt.findUnique({
        where: { id },
      });

      if (!existingReceipt) {
        throw new NotFoundException(`Receipt with ID ${id} not found`);
      }

      // Удаляем чек (продукты чека удалятся автоматически благодаря CASCADE)
      await this.prisma.receipt.delete({
        where: { id },
      });

      this.logger.log(`Successfully removed receipt ${id}`);
      return { success: true, message: `Receipt ${id} has been removed` };
    } catch (error) {
      this.logger.error(`Error removing receipt ${id}:`, error);
      throw error;
    }
  }

  async createTestReceiptForCashback() {
    this.logger.log('Creating test receipt for cashback testing');
    
    try {
      // Получаем первую доступную промоакцию
      const promotion = await this.prisma.promotion.findFirst();
      if (!promotion) {
        throw new Error('No promotions found in the system');
      }

      // Получаем несколько продуктов для тестирования
      const products = await this.prisma.product.findMany({
        take: 3,
        include: {
          brand: true,
        },
      });

      if (products.length === 0) {
        throw new Error('No products found in the system');
      }

      // Получаем активные акции
      const now = new Date();
      const offers = await this.prisma.offer.findMany({
        where: {
          promotionId: promotion.promotionId,
          date_from: { lte: now },
          date_to: { gte: now },
        },
        take: 2,
      });

      // Создаем тестовый чек
      const testReceiptData = {
        date: new Date().toISOString(),
        number: Math.floor(Math.random() * 100000) + 10000,
        price: 0,
        cashback: 0,
        status: 'success' as const,
        address: 'Тестовый магазин, ул. Тестовая, д. 1',
        promotionId: promotion.promotionId,
        products: [] as any[],
      };

      // Рассчитываем цены и кэшбек для каждого продукта
      let totalPrice = 0;
      let totalCashback = 0;

      for (const product of products) {
        const quantity = Math.floor(Math.random() * 3) + 1;
        const itemPrice = Math.floor(Math.random() * 1000) + 100; // 100-1100 копеек
        const totalItemPrice = itemPrice * quantity;
        
        // Простой расчет кэшбека (5% от цены)
        const itemCashback = Math.floor(totalItemPrice * 0.05);
        
        totalPrice += totalItemPrice;
        totalCashback += itemCashback;

        // Выбираем случайную акцию для продукта
        const randomOffer = offers.length > 0 ? offers[Math.floor(Math.random() * offers.length)] : null;

        testReceiptData.products.push({
          productId: product.id,
          offerId: randomOffer?.id || null,
          cashback: itemCashback,
        });
      }

      testReceiptData.price = totalPrice;
      testReceiptData.cashback = totalCashback;

      // Создаем чек
      const receipt = await this.prisma.receipt.create({
        data: {
          date: new Date(testReceiptData.date),
          number: testReceiptData.number,
          price: testReceiptData.price,
          cashback: testReceiptData.cashback,
          status: testReceiptData.status,
          address: testReceiptData.address,
          promotionId: testReceiptData.promotionId,
        },
      });

      // Создаем продукты чека
      if (testReceiptData.products.length > 0) {
        await Promise.all(
          testReceiptData.products.map(product =>
            this.prisma.receiptProduct.create({
              data: {
                productId: product.productId,
                offerId: product.offerId,
                cashback: product.cashback,
                receiptId: receipt.id,
              },
            })
          )
        );
      }

      // Возвращаем созданный чек с деталями
      const createdReceipt = await this.prisma.receipt.findUnique({
        where: { id: receipt.id },
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
          promotion: {
            select: {
              promotionId: true,
              name: true,
            },
          },
        },
      });

      this.logger.log(`Successfully created test receipt ${receipt.id} with total price: ${totalPrice} and cashback: ${totalCashback}`);
      
      return {
        message: 'Test receipt created successfully for cashback testing',
        receipt: createdReceipt,
        summary: {
          totalPrice,
          totalCashback,
          productsCount: products.length,
          offersApplied: offers.length,
        },
      };
    } catch (error) {
      this.logger.error('Error creating test receipt for cashback:', error);
      throw error;
    }
  }

  async createFromFns(
    receiptData: any,
    customerId: number,
    promotionId: string,
    calculationResult: CashbackCalculationResult,
  ) {
    this.logger.log('Creating receipt from FNS data');

    return await this.prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.create({
        data: {
          date: new Date(receiptData.dateTime || receiptData.date),
          number: parseInt(receiptData.fiscalDocumentNumber || receiptData.fd),
          price: parseInt(receiptData.totalSum || receiptData.sum),
          cashback: calculationResult.totalCashback,
          status: 'success',
          address: receiptData.retailPlace || 'Неизвестно',
          promotionId,
          customerId,
        },
      });

      const itemsToCreate = (calculationResult.items || [])
        .filter((item) => item.productId)
        .map((item) => ({
          productId: item.productId!,
          offerId: item.offerId ?? null,
          cashback: item.cashbackAmount,
          receiptId: receipt.id,
        }));

      if (itemsToCreate.length > 0) {
        // No createMany in Prisma per-record return; use Promise.all for clarity
        await Promise.all(
          itemsToCreate.map((data) => tx.receiptProduct.create({ data }))
        );
      }

      const createdReceipt = await tx.receipt.findUnique({
        where: { id: receipt.id },
        include: {
          products: {
            include: {
              product: true,
              offer: true,
            },
          },
          customer: {
            select: { id: true, name: true, surname: true, email: true },
          },
          promotion: { select: { promotionId: true, name: true } },
        },
      });

      this.logger.log(`Receipt from FNS created: ${receipt.id}`);
      return createdReceipt;
    });
  }
}
