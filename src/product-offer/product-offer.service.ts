import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class ProductOfferService {
  constructor(private readonly prisma: PrismaService) {}

  async createProductsRelation(ids: number[], offerId: number) {
    return this.prisma.productOffer.createMany({
      data: ids.map((productId) => ({
        productId: productId,
        offerId,
      })),
    });
  }

  async updateProductsRelation(ids: number[], offerId: number) {
    const currentRelations = await this.getProductsRelationsOfferId(offerId);
    const deletedIds = currentRelations
      .filter((relation) => !ids.includes(relation.productId))
      .map((relation) => relation.productId);
    const idsToAdd = ids.filter(
      (id) => !currentRelations.some((relation) => relation.productId === id),
    );

    if (deletedIds.length) {
      await this.removeProductsRelations(deletedIds, offerId);
    }
    if (idsToAdd.length) {
      await this.createProductsRelation(idsToAdd, offerId);
    }
  }

  async getProductsRelationsOfferId(offerId: number) {
    return await this.prisma.productOffer.findMany({ where: { offerId } });
  }

  async removeProductsRelations(ids: number[], offerId: number) {
    return await this.prisma.productOffer.deleteMany({
      where: {
        productId: { in: ids },
        offerId,
      },
    });
  }
}
