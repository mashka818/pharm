import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { OffersConditionsService } from 'src/offers-conditions/offers-conditions.service';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { ProductOfferService } from 'src/product-offer/product-offer.service';
import { FilesService } from 'src/files/files.service';
import { GetOneOfferService } from './get-one-offer.service';
import { ResponseOfferDtoWithProducts } from './dto/response-offer.dto';

@Injectable()
export class UpdateOfferService {
  private readonly logger = new Logger(UpdateOfferService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly offersConditionsService: OffersConditionsService,
    private readonly productOfferService: ProductOfferService,
    private readonly filesService: FilesService,
    private readonly getOneOfferService: GetOneOfferService,
  ) {}

  async update(
    id: number,
    updateOfferDto: UpdateOfferDto,
    banner_image?: Express.Multer.File,
  ): Promise<ResponseOfferDtoWithProducts> {
    const { productIds, condition, conditionId, ...offerData } = updateOfferDto;

    const prevOffer = await this.getOneOfferService.getOne(id);

    if (banner_image) {
      this.filesService.deleteFile(prevOffer.banner_image);
    }

    const bannerName = banner_image
      ? await this.filesService.createFile(banner_image)
      : prevOffer.banner_image;

    let newCondition = prevOffer.condition;

    if ('conditionId' in updateOfferDto && !conditionId && prevOffer.conditionId) {
      if (prevOffer.conditionId) {
        await this.offersConditionsService.remove(prevOffer.conditionId);
      }
      newCondition = null;
    } else {
      if (condition) {
        if (prevOffer.conditionId) {
          newCondition = await this.offersConditionsService.update(condition);
        } else {
          newCondition = await this.offersConditionsService.create(condition);
        }

        if (!newCondition) {
          throw new BadRequestException('Incorrect condition data');
        }
      }
    }

    await this.prisma.offer.update({
      where: { id },
      data: {
        ...offerData,
        banner_image: bannerName,
        conditionId: newCondition ? newCondition.id : null,
      },
    });

    if (productIds) {
      const offer = await this.prisma.offer.findUnique({ where: { id }, select: { promotionId: true } });
      await this.validateProductsForPromotion(productIds, offer.promotionId);
      await this.productOfferService.updateProductsRelation(productIds, id);
    }

    return await this.getOneOfferService.getOneWithProducts(id);
  }

  
  private async validateProductsForPromotion(productIds: number[], promotionId: string) {
    this.logger.log(`Validating ${productIds.length} products for promotion ${promotionId} during update`);

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

    this.logger.log(`All ${productIds.length} products validated successfully for promotion ${promotionId} during update`);
  }
}
