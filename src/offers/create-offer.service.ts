import { BadRequestException, forwardRef, Inject, Injectable } from '@nestjs/common';
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
    const { productIds, condition, ...offerData } = createOfferDto;

    await this.promotionsService.findOne(offerData.promotionId);

    if (!bannerImage) {
      throw new BadRequestException('add banner image to request');
    }

    const bannerName = await this.filesService.createFile(bannerImage);

    const offer = await this.prisma.offer.create({
      data: { ...offerData, banner_image: bannerName },
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

    return await this.getOneOfferService.getOneWithProducts(offer.id);
  }
}
