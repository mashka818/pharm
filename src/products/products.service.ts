import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { BrandsService } from 'src/brands/brands.service';
import { ProductDtoWithBrand } from './dto/product-with-brands.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brandsService: BrandsService,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<UpdateProductDto> {
    const brand = await this.brandsService.getOne(createProductDto.brandId);

    return this.prisma.product.create({
      data: { promotionId: brand.promotionId, ...createProductDto },
    });
  }

  async getAll(): Promise<UpdateProductDto[]> {
    return this.prisma.product.findMany();
  }
  async getOne(id: number): Promise<UpdateProductDto> {
    const product = await this.prisma.product.findUnique({ where: { id } });

    if (!product) {
      throw new NotFoundException(`Product not found`);
    }
    return product;
  }

  async update(id: number, updateProductDto: UpdateProductDto): Promise<UpdateProductDto> {
    await this.getOne(id);

    const { promotionId, brandId, ...restProduct } = updateProductDto;

    return this.prisma.product.update({
      where: { id },
      data: restProduct,
    });
  }

  async remove(id: number) {
    await this.getOne(id);
    await this.prisma.product.delete({ where: { id } });

    return `Product with id:${id} is deleted`;
  }

  async searchProductsByStringAndPromotionId(
    searchString: string,
    promotionId: string,
  ): Promise<ProductDtoWithBrand[]> {
    return await this.prisma.product.findMany({
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
            sku: {
              contains: searchString,
              mode: 'insensitive',
            },
          },
        ],
      },
      include: {
        brand: true,
      },
    });
  }
}
