import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { FilesService } from 'src/files/files.service';
import { PromotionsService } from './promotions.service';
import { PromotionDto } from './dto/promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';

@Injectable()
export class UpdatePromotionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
    private readonly promotionService: PromotionsService,
  ) {}
  async update(
    promotionId: string,
    updatePromotionDto: UpdatePromotionDto,
    logo?: Express.Multer.File[],
    banner?: Express.Multer.File[],
    favicon?: Express.Multer.File[],
  ): Promise<PromotionDto> {
    const currentPromotion = await this.promotionService.findOne(promotionId);

    let bannerName = currentPromotion.banner;

    if (banner) {
      bannerName = await this.filesService.createFile(banner[0]);
      if (currentPromotion.banner) {
        this.filesService.deleteFile(currentPromotion.banner);
      }
    }

    if ('banner' in updatePromotionDto && !updatePromotionDto.banner && currentPromotion.banner) {
      bannerName = null;
      this.filesService.deleteFile(currentPromotion.banner);
    }

    let logoName = currentPromotion.logo;
    if (logo) {
      logoName = await this.filesService.createFile(logo[0]);
      this.filesService.deleteFile(currentPromotion.logo);
    }

    let faviconName = currentPromotion.favicon;
    if (favicon) {
      faviconName = await this.filesService.createFile(favicon[0]);
      this.filesService.deleteFile(currentPromotion.favicon);
    }

    return await this.prisma.promotion.update({
      where: {
        promotionId,
      },
      data: { ...updatePromotionDto, banner: bannerName, logo: logoName, favicon: faviconName },
    });
  }
}
