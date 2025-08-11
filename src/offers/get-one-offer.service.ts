import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { ResponseOfferDto, ResponseOfferDtoWithProducts } from './dto/response-offer.dto';

@Injectable()
export class GetOneOfferService {
  constructor(private readonly prisma: PrismaService) {}

  async getOne(id: number): Promise<ResponseOfferDto> {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
      include: {
        condition: true,
      },
    });

    const offerWithStringDate = {
      ...offer,
      date_from: offer.date_from.toISOString(),
      date_to: offer.date_to.toISOString(),
    };

    if (!offer) {
      throw new NotFoundException(`Offer not found`);
    }

    return offerWithStringDate;
  }

  async getOneWithProducts(id: number): Promise<ResponseOfferDtoWithProducts> {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
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

    if (!offer) {
      throw new NotFoundException(`Offer with id:${id} not found`);
    }

    const offerWithStringDate = {
      ...offer,
      date_from: offer.date_from.toISOString(),
      date_to: offer.date_to.toISOString(),
    };

    const products = offerWithStringDate.products.map((productOffer) => productOffer.product);

    return {
      ...offerWithStringDate,
      products,
    };
  }
}
