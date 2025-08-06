import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
  Query,
  Patch,
} from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { FullBrandDto } from 'src/brands/dto/full-brand.dto';
import { UpdatePromotionService } from './update-promotion.service';
import { PromotionBrandDto } from 'src/brands/dto/promotion-brand.dto';
import { Public } from 'src/decorators/public.decorator';
import { SearchProductsAndBrandsDto } from 'src/search/dto/search-products-and-brands-dto';
import { SearchService } from 'src/search/search.service';
import { PromotionDto } from './dto/promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { ResponseOfferDtoWithProducts } from 'src/offers/dto/response-offer.dto';

@ApiTags('Promotion')
@Controller('promotions')
export class PromotionsController {
  constructor(
    private readonly promotionsService: PromotionsService,
    private readonly updatePromotionService: UpdatePromotionService,
    private readonly searchService: SearchService,
  ) {}

  @UseGuards(AdminGuard)
  @ApiResponse({ type: PromotionDto })
  @ApiBody({ type: PromotionDto })
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'banner', maxCount: 1 },
      { name: 'logo', maxCount: 1 },
      { name: 'favicon', maxCount: 1 },
    ]),
  )
  create(
    @Body() promotionDto: PromotionDto,
    @UploadedFiles()
    files: {
      banner?: Express.Multer.File[];
      logo: Express.Multer.File[];
      favicon: Express.Multer.File[];
    },
  ) {
    const { banner, logo, favicon } = files;

    return this.promotionsService.create(promotionDto, logo, banner, favicon);
  }

  @UseGuards(AdminGuard)
  @ApiResponse({ type: [PromotionDto] })
  @Get()
  findAll() {
    return this.promotionsService.findAll();
  }

  @ApiResponse({ type: PromotionDto })
  @Get(':promotionId')
  findOne(@Param('promotionId') promotionId: string) {
    return this.promotionsService.findOne(promotionId);
  }

  @UseGuards(AdminGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'banner', maxCount: 1 },
      { name: 'logo', maxCount: 1 },
      { name: 'favicon', maxCount: 1 },
    ]),
  )
  @ApiResponse({ type: PromotionDto })
  @ApiBody({ type: PromotionDto })
  @Patch(':promotionId')
  update(
    @Param('promotionId') promotionId: string,
    @Body() updatePromotionDto: UpdatePromotionDto,
    @UploadedFiles()
    files: {
      banner?: Express.Multer.File[];
      logo: Express.Multer.File[];
      favicon: Express.Multer.File[];
    },
  ) {
    const { banner, logo, favicon } = files;

    return this.updatePromotionService.update(
      promotionId,
      updatePromotionDto,
      logo,
      banner,
      favicon,
    );
  }

  @UseGuards(AdminGuard)
  @Delete(':promotionId')
  remove(@Param('promotionId') promotionId: string) {
    return this.promotionsService.remove(promotionId);
  }

  @Public()
  @ApiOperation({ summary: 'Get offers with pagination fom promotion' })
  @ApiResponse({ type: [ResponseOfferDtoWithProducts] })
  @Get(':promotionId/offers')
  getOffersFromPromotionWithPagination(
    @Param('promotionId') promotionId: string,
    @Query('page') page: number,
  ) {
    return this.promotionsService.getOffersWithPagination(promotionId, page || 1);
  }

  @Public()
  @ApiOperation({ summary: 'Get full brand data from promotion' })
  @ApiResponse({ type: FullBrandDto })
  @Get(':promotionId/brands/:id')
  getFullBrandFromPromotion(@Param('promotionId') promotionId: string, @Param('id') id: number) {
    return this.promotionsService.getFullBrand(promotionId, id);
  }

  @Public()
  @ApiOperation({ summary: 'Get brands list from promotion' })
  @ApiResponse({ type: [PromotionBrandDto] })
  @Get(':promotionId/brands/')
  getBrandsFromPromotion(@Param('promotionId') promotionId: string) {
    return this.promotionsService.getBrands(promotionId);
  }

  @Public()
  @ApiOperation({ summary: 'Search in promotion' })
  @ApiResponse({ type: SearchProductsAndBrandsDto })
  @Get(':promotionId/search')
  async SearchProductsAndBrands(
    @Query('searchString') searchString: string,
    @Param('promotionId') promotionId: string,
  ) {
    return await this.searchService.searchProductsAndBrandsByString(searchString, promotionId);
  }
}
