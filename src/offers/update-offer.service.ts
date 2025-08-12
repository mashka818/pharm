import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { OffersConditionsService } from 'src/offers-conditions/offers-conditions.service';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { ProductOfferService } from 'src/product-offer/product-offer.service';
import { FilesService } from 'src/files/files.service';
import { GetOneOfferService } from './get-one-offer.service';
import { ResponseOfferDtoWithProducts } from './dto/response-offer.dto';

@Injectable()
export class UpdateOfferService {
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
      await this.offersConditionsService.remove(prevOffer.conditionId);
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

    await this.productOfferService.updateProductsRelation(productIds, id);

    return await this.getOneOfferService.getOneWithProducts(id);
  }
}
