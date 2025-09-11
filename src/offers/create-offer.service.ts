import { BadRequestException, forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OffersConditionsService } from 'src/offers-conditions/offers-conditions.service';
import { ProductOfferService } from 'src/product-offer/product-offer.service';
import { FilesService } from 'src/files/files.service';
import { PromotionsService } from 'src/promotions/promotions.service';
import { ResponseOfferDto } from './dto/response-offer.dto';
import { GetOneOfferService } from './get-one-offer.service';

@Injectable()
export class CreateOfferService {
  private readonly logger = new Logger(CreateOfferService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly offersConditionsService: OffersConditionsService,
    private readonly productOfferService: ProductOfferService,
    private readonly filesService: FilesService,
    @Inject(forwardRef(() => PromotionsService))
    private readonly promotionsService: PromotionsService,
    private readonly getOneOfferService: GetOneOfferService,
  ) {}

  async create(
    createOfferDto: CreateOfferDto,
    bannerImage?: Express.Multer.File,
  ): Promise<ResponseOfferDto> {
    const { productIds, condition, isLottery, lotteryPrize, lotteryWinners, ...offerData } = createOfferDto;

    this.logger.log(`Creating offer for promotion ${offerData.promotionId} with ${productIds.length} products`);

    await this.promotionsService.findOne(offerData.promotionId);

    await this.validateProductsForPromotion(productIds, offerData.promotionId);

    if (!bannerImage) {
      throw new BadRequestException('add banner image to request');
    }

    const bannerName = await this.filesService.createFile(bannerImage);

    if (isLottery) {
      if (!lotteryPrize || !lotteryWinners) {
        throw new BadRequestException('For lottery offers, lotteryPrize and lotteryWinners are required');
      }
    }

    const offer = await this.prisma.offer.create({
      data: { 
        ...offerData, 
        banner_image: bannerName,
        isLottery: isLottery || false,
        lotteryPrize: isLottery ? lotteryPrize : null,
        lotteryWinners: isLottery ? lotteryWinners : null,
      },
    });

    if (condition) {
      const createdCondition = await this.offersConditionsService.create(condition);

      if (!createdCondition) {
        throw new BadRequestException('Incorrect condition data');
      }

      await this.prisma.offer.update({
        where: { id: offer.id },
        data: { conditionId: createdCondition.id },
      });
    }

    await this.productOfferService.createProductsRelation(productIds, offer.id);

    this.logger.log(`Successfully created offer ${offer.id} for promotion ${offerData.promotionId}`);
    return await this.getOneOfferService.getOneWithProducts(offer.id);
  }

  
  private async validateProductsForPromotion(productIds: number[], promotionId: string) {
    this.logger.log(`Validating ${productIds.length} products for promotion ${promotionId}`);

    if (!productIds || productIds.length === 0) {
      throw new BadRequestException('At least one product is required for offer');
    }

    const invalidProducts = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        promotionId: { not: promotionId },
      },
      select: { 
        id: true, 
        name: true, 
        promotionId: true,
        brand: {
          select: {
            name: true,
            promotionId: true,
          }
        }
      },
    });

    if (invalidProducts.length > 0) {
      const productInfo = invalidProducts.map(p => 
        `"${p.name}" (ID: ${p.id}, подсеть: ${p.promotionId}, бренд: ${p.brand?.name})`
      ).join(', ');
      
      throw new BadRequestException(
        `Товары из другой подсети не могут быть добавлены в предложение для подсети ${promotionId}. ` +
        `Некорректные товары: ${productInfo}`
      );
    }

    const existingProducts = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        promotionId,
      },
      select: { id: true },
    });

    const existingProductIds = existingProducts.map(p => p.id);
    const missingProductIds = productIds.filter(id => !existingProductIds.includes(id));

    if (missingProductIds.length > 0) {
      throw new BadRequestException(
        `Товары с ID ${missingProductIds.join(', ')} не найдены в подсети ${promotionId}`
      );
    }

    this.logger.log(`All ${productIds.length} products validated successfully for promotion ${promotionId}`);
  }
}
