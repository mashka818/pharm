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

    this.filesService.deleteFile(promotion.logo);
    this.filesService.deleteFile(promotion.favicon);

    if (promotion.banner) {
      this.filesService.deleteFile(promotion.banner);
    }

    await this.prisma.promotion.delete({ where: { promotionId } });

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
