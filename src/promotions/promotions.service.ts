import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { FilesService } from 'src/files/files.service';
import { OffersService } from 'src/offers/offers.service';
import { BrandsService } from 'src/brands/brands.service';
import { FullBrandDto } from 'src/brands/dto/full-brand.dto';
import { PromotionDto } from './dto/promotion.dto';
import { ResponseOfferDtoWithProducts } from 'src/offers/dto/response-offer.dto';

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
    private readonly offersService: OffersService,
    private readonly brandsService: BrandsService,
  ) {}

  async create(
    promotionDto: PromotionDto,
    logo?: Express.Multer.File[],
    banner?: Express.Multer.File[],
    favicon?: Express.Multer.File[],
  ): Promise<PromotionDto> {
    if (!logo || !favicon) {
      throw new BadRequestException('Logo and Favicon required');
    }
    const samePromotion = await this.findOneByPromotionId(promotionDto.promotionId);
    if (samePromotion) {
      throw new BadRequestException('Promotion with this promotionId already exist');
    }
    const bannerName = banner ? await this.filesService.createFile(banner[0]) : null;
    const logoName = await this.filesService.createFile(logo[0]);
    const faviconName = await this.filesService.createFile(favicon[0]);
    return await this.prisma.promotion.create({
      data: {
        ...promotionDto,
        banner: bannerName,
        logo: logoName,
        favicon: faviconName,
      },
    });
  }

  async findAll(): Promise<PromotionDto[]> {
    return await this.prisma.promotion.findMany();
  }

  async findOne(promotionId: string): Promise<PromotionDto> {
    const promotion = await this.findOneByPromotionId(promotionId);
    if (!promotion) {
      throw new NotFoundException(`Promotion not found`);
    }
    return promotion;
  }

  async findOneByPromotionId(promotionId: string): Promise<PromotionDto> {
    return await this.prisma.promotion.findUnique({
      where: {
        promotionId: promotionId,
      },
    });
  }

  async remove(promotionId: string): Promise<string> {
    const promotion = await this.findOne(promotionId);

    await this.prisma.$transaction(async (prisma) => {
      const receiptsToDelete = await prisma.receipt.findMany({
        where: { promotionId },
        select: { id: true }
      });
      const receiptIds = receiptsToDelete.map(r => r.id);

      if (receiptIds.length > 0) {
        await prisma.receiptProduct.deleteMany({
          where: { receiptId: { in: receiptIds } }
        });
      }

      const customersToDelete = await prisma.customer.findMany({
        where: { promotionId },
        select: { id: true }
      });
      const customerIds = customersToDelete.map(c => c.id);

      if (customerIds.length > 0) {
        await prisma.withdrawalVariant.deleteMany({
          where: { customerId: { in: customerIds } }
        });
      }

      const cashbacksToDelete = await prisma.cashback.findMany({
        where: { promotionId },
        select: { id: true }
      });
      const cashbackIds = cashbacksToDelete.map(c => c.id);

      if (cashbackIds.length > 0) {
        await prisma.cashbackItem.deleteMany({
          where: { cashbackId: { in: cashbackIds } }
        });
      }

      const productsToDelete = await prisma.product.findMany({
        where: { promotionId },
        select: { id: true }
      });
      const productIds = productsToDelete.map(p => p.id);

      if (productIds.length > 0) {
        await prisma.productOffer.deleteMany({
          where: { productId: { in: productIds } }
        });
      }

      const offersToDelete = await prisma.offer.findMany({
        where: { promotionId },
        select: { conditionId: true }
      });
      const conditionIds = offersToDelete
        .map(o => o.conditionId)
        .filter((id): id is number => id !== null);

      if (conditionIds.length > 0) {
        await prisma.offerCondition.deleteMany({
          where: { id: { in: conditionIds } }
        });
      }

      await prisma.adminNotification.deleteMany({ where: { promotionId } });
      await prisma.cashback.deleteMany({ where: { promotionId } });
      await prisma.receipt.deleteMany({ where: { promotionId } });
      await prisma.fnsRequest.deleteMany({ where: { promotionId } });
      await prisma.customer.deleteMany({ where: { promotionId } });
      await prisma.product.deleteMany({ where: { promotionId } });
      await prisma.brand.deleteMany({ where: { promotionId } });
      await prisma.offer.deleteMany({ where: { promotionId } });
      await prisma.company.deleteMany({ where: { promotionId } });

      await prisma.promotion.delete({ where: { promotionId } });
    });

    this.filesService.deleteFile(promotion.logo);
    this.filesService.deleteFile(promotion.favicon);

    if (promotion.banner) {
      this.filesService.deleteFile(promotion.banner);
    }

    return `Promotion with id:${promotionId} is deleted`;
  }

  async getOffersWithPagination(
    promotionId: string,
    page: number,
  ): Promise<ResponseOfferDtoWithProducts[]> {
    await this.findOne(promotionId);
    return await this.offersService.getOffersByPromotionIdWithPagination(promotionId, page);
  }
  async getFullBrand(promotionId: string, id: number): Promise<FullBrandDto> {
    await this.findOne(promotionId);
    return await this.brandsService.getFullBrandByPromotionId(promotionId, id);
  }
  async getBrands(promotionId: string) {
    await this.findOne(promotionId);
    return await this.brandsService.getAllBrandsByPromotionIdWithRange(promotionId);
  }
}
