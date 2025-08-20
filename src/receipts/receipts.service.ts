import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';
import { PrismaService } from '../prisma.service';
import { CashbackService } from '../cashback/cashback.service';

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cashbackService: CashbackService,
  ) {}

  /**
   * Создание чека с автоматическим расчетом и начислением кешбека
   */
  async createReceiptWithCashback(createReceiptDto: CreateReceiptDto) {
    this.logger.log(`Creating receipt with number: ${createReceiptDto.number}`);

    try {
      // Валидация существования промоакции
      const promotion = await this.prisma.promotion.findUnique({
        where: { promotionId: createReceiptDto.promotionId },
      });

      if (!promotion) {
        throw new BadRequestException(`Promotion ${createReceiptDto.promotionId} not found`);
      }

      // Валидация клиента, если указан
      if (createReceiptDto.customerId) {
        const customer = await this.prisma.customer.findUnique({
          where: { id: createReceiptDto.customerId },
          select: { id: true, promotionId: true, name: true, surname: true },
        });

        if (!customer) {
          throw new BadRequestException(`Customer ${createReceiptDto.customerId} not found`);
        }

        // Проверяем, что клиент принадлежит к той же подсети
        if (customer.promotionId !== createReceiptDto.promotionId) {
          throw new BadRequestException(
            `Customer belongs to promotion ${customer.promotionId}, but receipt is for promotion ${createReceiptDto.promotionId}`
          );
        }
      }

      // Валидация товаров - проверяем, что все товары принадлежат к указанной подсети
      if (createReceiptDto.products && createReceiptDto.products.length > 0) {
        await this.validateProductsForPromotion(createReceiptDto.products, createReceiptDto.promotionId);
      }

      // Создаем чек
      const receipt = await this.prisma.receipt.create({
        data: {
          date: new Date(createReceiptDto.date),
          number: createReceiptDto.number,
          price: createReceiptDto.price,
          cashback: 0, // Будет обновлено после расчета
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
                cashback: product.cashback || 0,
                receiptId: receipt.id,
              },
            })
          )
        );

        this.logger.log(`Created ${receiptProducts.length} receipt products for receipt ${receipt.id}`);
      }

      let totalCashback = 0;
      let calculationResult = null;

      // Автоматически рассчитываем и начисляем кешбек, если есть клиент и товары
      if (createReceiptDto.customerId && createReceiptDto.products && createReceiptDto.products.length > 0) {
        try {
          this.logger.log(`Calculating cashback for receipt ${receipt.id} and customer ${createReceiptDto.customerId}`);
          
          // Получаем полные данные о чеке для расчета кешбека
          const receiptForCashback = await this.prisma.receipt.findUnique({
            where: { id: receipt.id },
            include: {
              products: {
                include: {
                  product: true,
                  offer: true,
                },
              },
            },
          });

          // Рассчитываем кешбек
          calculationResult = await this.cashbackService.calculateCashback(
            receiptForCashback,
            createReceiptDto.customerId,
            createReceiptDto.promotionId
          );

          totalCashback = calculationResult.totalCashback;

          // Начисляем кешбек, если он больше 0
          if (totalCashback > 0) {
            const cashbackResult = await this.cashbackService.awardCashback(
              createReceiptDto.customerId,
              null, // Для обычных чеков нет fnsRequestId
              receipt.id,
              createReceiptDto.promotionId,
              calculationResult
            );

            this.logger.log(`Awarded cashback ${cashbackResult.amount} for receipt ${receipt.id}`);
          } else {
            this.logger.log(`No cashback awarded for receipt ${receipt.id} - no applicable offers found`);
          }
        } catch (cashbackError) {
          this.logger.error(`Error calculating/awarding cashback for receipt ${receipt.id}:`, cashbackError);
          // Не прерываем создание чека из-за ошибки кешбека
        }
      }

      // Обновляем сумму кешбека в чеке
      await this.prisma.receipt.update({
        where: { id: receipt.id },
        data: { cashback: totalCashback },
      });

      // Возвращаем созданный чек с продуктами
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

      this.logger.log(`Successfully created receipt ${receipt.id} with cashback processing`);
      
      return {
        message: `Receipt created successfully${createReceiptDto.customerId ? ` for customer ${createdReceipt?.customer?.name}` : ''}`,
        receipt: createdReceipt,
        summary: {
          customerId: createReceiptDto.customerId,
          customerName: createdReceipt?.customer?.name,
          promotionId: createReceiptDto.promotionId,
          totalPrice: createReceiptDto.price,
          totalCashback,
          productsCount: createReceiptDto.products?.length || 0,
          offersApplied: calculationResult?.appliedOffers?.length || 0,
        },
      };
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
      // Используем тестового пользователя с ID 1
      const testCustomerId = 1;
      
      // Проверяем существование пользователя ID 1
      const testCustomer = await this.prisma.customer.findUnique({
        where: { id: testCustomerId },
        select: { id: true, promotionId: true, name: true },
      });

      if (!testCustomer) {
        throw new Error('Test customer with ID 1 not found. Please create a customer with ID 1 first.');
      }

      // Используем промоакцию клиента
      const promotion = await this.prisma.promotion.findUnique({
        where: { promotionId: testCustomer.promotionId },
      });

      if (!promotion) {
        throw new Error(`Promotion ${testCustomer.promotionId} not found for test customer`);
      }

      // Получаем продукты из той же подсети что и клиент
      const products = await this.prisma.product.findMany({
        where: {
          promotionId: testCustomer.promotionId,
        },
        take: 3,
        include: {
          brand: true,
        },
      });

      if (products.length === 0) {
        throw new Error('No products found in the system');
      }

      // Получаем активные акции для подсети клиента
      const now = new Date();
      const offers = await this.prisma.offer.findMany({
        where: {
          promotionId: testCustomer.promotionId,
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
        customerId: testCustomerId,
        promotionId: testCustomer.promotionId,
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

      // Создаем чек с привязкой к тестовому клиенту
      const receipt = await this.prisma.receipt.create({
        data: {
          date: new Date(testReceiptData.date),
          number: testReceiptData.number,
          price: testReceiptData.price,
          cashback: testReceiptData.cashback,
          status: testReceiptData.status,
          address: testReceiptData.address,
          customerId: testReceiptData.customerId,
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

      // Создаем кешбек для тестового чека
      if (totalCashback > 0) {
        const testCashback = await this.prisma.cashback.create({
          data: {
            customerId: testCustomerId,
            receiptId: receipt.id,
            promotionId: testCustomer.promotionId,
            amount: totalCashback,
            status: 'active',
            items: {
              create: testReceiptData.products.map(product => ({
                productId: product.productId,
                offerId: product.offerId,
                productName: products.find(p => p.id === product.productId)?.name || 'Test Product',
                productSku: products.find(p => p.id === product.productId)?.sku || 'TEST-SKU',
                quantity: 1,
                itemPrice: Math.floor(Math.random() * 1000) + 100,
                totalPrice: Math.floor(Math.random() * 1000) + 100,
                cashbackAmount: product.cashback,
                cashbackType: 'percent',
                cashbackRate: 5,
              })),
            },
          },
        });

        // Начисляем бонусы клиенту
        await this.prisma.customer.update({
          where: { id: testCustomerId },
          data: {
            bonuses: {
              increment: totalCashback,
            },
          },
        });

        this.logger.log(`Created cashback ${testCashback.id} with amount ${totalCashback} for test receipt ${receipt.id}`);
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

      this.logger.log(`Successfully created test receipt ${receipt.id} for customer ${testCustomer.name} (ID: ${testCustomerId}) with total price: ${totalPrice} and cashback: ${totalCashback}`);
      
      return {
        message: `Test receipt created successfully for customer ${testCustomer.name} (ID: ${testCustomerId}) in promotion ${testCustomer.promotionId}`,
        receipt: createdReceipt,
        summary: {
          customerId: testCustomerId,
          customerName: testCustomer.name,
          promotionId: testCustomer.promotionId,
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

  /**
   * Валидация товаров для промоакции - проверяет, что все товары принадлежат к указанной подсети
   */
  private async validateProductsForPromotion(products: any[], promotionId: string) {
    this.logger.log(`Validating ${products.length} products for promotion ${promotionId}`);

    const productIds = products.map(p => p.productId).filter(Boolean);
    const offerIds = products.map(p => p.offerId).filter(Boolean);

    // Проверяем товары
    if (productIds.length > 0) {
      const invalidProducts = await this.prisma.product.findMany({
        where: {
          id: { in: productIds },
          promotionId: { not: promotionId },
        },
        select: { id: true, name: true, promotionId: true },
      });

      if (invalidProducts.length > 0) {
        const productInfo = invalidProducts.map(p => `${p.name} (ID: ${p.id}, подсеть: ${p.promotionId})`).join(', ');
        throw new BadRequestException(
          `Товары из другой подсети не могут быть добавлены в чек для подсети ${promotionId}: ${productInfo}`
        );
      }
    }

    // Проверяем акции
    if (offerIds.length > 0) {
      const invalidOffers = await this.prisma.offer.findMany({
        where: {
          id: { in: offerIds },
          promotionId: { not: promotionId },
        },
        select: { id: true, promotionId: true },
      });

      if (invalidOffers.length > 0) {
        const offerInfo = invalidOffers.map(o => `ID: ${o.id}, подсеть: ${o.promotionId}`).join(', ');
        throw new BadRequestException(
          `Акции из другой подсети не могут быть использованы в чеке для подсети ${promotionId}: ${offerInfo}`
        );
      }
    }

    this.logger.log(`All products and offers validated successfully for promotion ${promotionId}`);
  }


}
