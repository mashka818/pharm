import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { OffersConditionsService } from 'src/offers-conditions/offers-conditions.service';
import { FilesService } from 'src/files/files.service';
import { ResponseOfferDto, ResponseOfferDtoWithProducts } from './dto/response-offer.dto';

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly offersConditionsService: OffersConditionsService,
    private readonly filesService: FilesService,
  ) {}

  async getAll(): Promise<ResponseOfferDto[]> {
    const offers = await this.prisma.offer.findMany({ include: { condition: true } });
    const offersWithStringDate = offers.map((offer) => ({
      ...offer,
      date_from: offer.date_from.toISOString(),
      date_to: offer.date_to.toISOString(),
    }));
    return offersWithStringDate;
  }

  async remove(id: number) {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
    });

    if (!offer) {
      throw new NotFoundException(`Offer with id:${id} not found`);
    }

    this.filesService.deleteFile(offer.banner_image);

    await this.offersConditionsService.remove(offer.conditionId);

    await this.prisma.offer.delete({
      where: { id },
    });

    return `Offer with id:${id} is deleted`;
  }

  async getOffersByPromotionIdWithPagination(
    promotionId: string,
    page: number,
  ): Promise<ResponseOfferDtoWithProducts[]> {
    const offers = await this.prisma.offer.findMany({
      where: { promotionId },
      skip: (page - 1) * 12,
      take: 12,
      include: {
        condition: true,
        products: {
          include: {
            product: {
              include: {
                brand: true,
              },
            },
          },
        },
      },
    });

    const formattedOffers: ResponseOfferDtoWithProducts[] = offers.map((offer) => {
      const products = offer.products.map((productOffer) => productOffer.product);
      return {
        ...offer,
        products,
        date_from: offer.date_from.toISOString(),
        date_to: offer.date_to.toISOString(),
      };
    });

    return formattedOffers;
  }
}
