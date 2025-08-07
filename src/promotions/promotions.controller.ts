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
import { ApiBody, ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
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

@ApiBearerAuth()
@ApiTags('Promotion')
@Controller('promotions')
export class PromotionsController {
  constructor(
    private readonly promotionsService: PromotionsService,
    private readonly updatePromotionService: UpdatePromotionService,
    private readonly searchService: SearchService,
  ) {}

  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Создать промоакцию', description: 'Создаёт новую промоакцию.' })
  @ApiResponse({ status: 201, description: 'Промоакция успешно создана', type: PromotionDto })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 409, description: 'Промоакция с таким кодом уже существует' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
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
  @ApiOperation({ summary: 'Получить все промоакции', description: 'Возвращает список всех промоакций.' })
  @ApiResponse({ status: 200, description: 'Список промоакций', type: [PromotionDto] })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @Get()
  findAll() {
    return this.promotionsService.findAll();
  }

  @ApiOperation({ summary: 'Получить промоакцию по ID', description: 'Возвращает данные промоакции по её идентификатору.' })
  @ApiResponse({ status: 200, description: 'Данные промоакции', type: PromotionDto })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Промоакция не найдена' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @Get(':promotionId')
  findOne(@Param('promotionId') promotionId: string) {
    return this.promotionsService.findOne(promotionId);
  }

  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Обновить промоакцию', description: 'Обновляет данные промоакции.' })
  @ApiResponse({ status: 200, description: 'Промоакция успешно обновлена', type: PromotionDto })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Промоакция не найдена' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @ApiBody({ type: PromotionDto })
  @Patch(':promotionId')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'banner', maxCount: 1 },
      { name: 'logo', maxCount: 1 },
      { name: 'favicon', maxCount: 1 },
    ]),
  )
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
  @ApiOperation({ summary: 'Удалить промоакцию', description: 'Удаляет промоакцию по идентификатору.' })
  @ApiResponse({ status: 200, description: 'Промоакция успешно удалена' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Промоакция не найдена' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
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
