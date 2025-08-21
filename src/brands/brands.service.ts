import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { FilesService } from 'src/files/files.service';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { FullBrandDto } from './dto/full-brand.dto';
import { PromotionBrandDto } from './dto/promotion-brand.dto';
import { PromotionsService } from 'src/promotions/promotions.service';

@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
    @Inject(forwardRef(() => PromotionsService))
    private readonly promotionsService: PromotionsService,
  ) {}

  async create(
    createBrandDto: CreateBrandDto,
    logo?: Express.Multer.File,
  ): Promise<UpdateBrandDto> {
    await this.promotionsService.findOneByPromotionId(createBrandDto.promotionId);

    if (!logo) {
      throw new BadRequestException('Logo is required');
    }
    const logoName = await this.filesService.createFile(logo);
    return this.prisma.brand.create({ data: { ...createBrandDto, logo: logoName } });
  }

  async getAll(): Promise<UpdateBrandDto[]> {
    return this.prisma.brand.findMany();
  }

  async getOne(id: number): Promise<UpdateBrandDto> {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) {
      throw new NotFoundException(`Brand not found`);
    }
    return brand;
  }

  async update(
    id: number,
    updateBrandDto: UpdateBrandDto,
    logo?: Express.Multer.File,
  ): Promise<UpdateBrandDto> {
    const brand = await this.getOne(id);

    let logoName = brand.logo;
    if (logo) {
      logoName = await this.filesService.createFile(logo);
      this.filesService.deleteFile(brand.logo);
    }

    return this.prisma.brand.update({
      where: { id },
      data: { ...updateBrandDto, logo: logoName },
    });
  }

  async remove(id: number) {
    const brand = await this.getOne(id);

    if (brand.logo) {
      this.filesService.deleteFile(brand.logo);
    }

    await this.prisma.brand.delete({ where: { id } });

    return `Brand with id:${id} is deleted`;
  }

  async getFullBrandByPromotionId(promotionId: string, id: number): Promise<FullBrandDto> {
    const brand = await this.prisma.brand.findUnique({
      where: { promotionId, id },
      include: {
        products: {
          include: {
            offers: {
              include: {
                offer: {
                  include: {
                    condition: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    const allOffers = [];
    const formattedBrand = { ...brand, products: [] };
    brand.products.forEach(({ offers, ...restProduct }) => {
      offers.forEach((offer) => {
        allOffers.push(offer.offer);
      });
      formattedBrand.products.push(restProduct);
    });
    const offers = allOffers.filter(
      (offer, index, self) => index === self.findIndex((second) => second.id === offer.id),
    );
    return {
      ...formattedBrand,
      offers,
    };
  }

  async getAllBrandsByPromotionIdWithRange(promotionId: string): Promise<PromotionBrandDto[]> {
    const brands = await this.getAllBrandsByPromotionId(promotionId);
    return brands.map((brand) => {
      // TODO: Логика диапазонов кешбека теперь рассчитывается через offers, а не fixCashback продуктов
      // Возвращаем брэнды без диапазонов кешбека пока не реализована новая логика
      const { products, ...restBrand } = brand;
      return restBrand;
    });
  }

  async getAllBrandsByPromotionId(promotionId: string): Promise<FullBrandDto[]> {
    return await this.prisma.brand.findMany({
      where: { promotionId },
      include: { 
        products: {
          include: {
            offers: {
              include: {
                offer: true
              }
            }
          }
        } 
      },
    });
  }

  async searchBrandsByStringAndPromotionId(
    searchString: string,
    promotionId: string,
  ): Promise<UpdateBrandDto[]> {
    return await this.prisma.brand.findMany({
      where: {
        promotionId,
        OR: [
          {
            name: {
              contains: searchString,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: searchString,
              mode: 'insensitive',
            },
          },
        ],
      },
    });
  }
}
