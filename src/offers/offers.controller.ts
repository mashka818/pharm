import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { OffersService } from './offers.service';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { ApiBody, ApiResponse, ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResponseOfferDto, ResponseOfferDtoWithProducts } from './dto/response-offer.dto';
import { GetOneOfferService } from './get-one-offer.service';
import { CreateOfferService } from './create-offer.service';
import { UpdateOfferService } from './update-offer.service';

@ApiBearerAuth()
@ApiTags('Offer')
@Controller('offers')
export class OffersController {
  constructor(
    private readonly offersService: OffersService,
    private readonly getOneOfferService: GetOneOfferService,
    private readonly createOfferService: CreateOfferService,
    private readonly updateOfferService: UpdateOfferService,
  ) {}

  @ApiOperation({ summary: 'Создать предложение', description: 'Создаёт новое предложение.' })
  @ApiResponse({ status: 201, description: 'Предложение успешно создано', type: ResponseOfferDto })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 409, description: 'Предложение с такими параметрами уже существует' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        profit: { type: 'number', example: 10 },
        profitType: { type: 'string', example: 'static' },
        banner_color: { type: 'string', example: 'green' },
        date_from: { type: 'string', example: '2024-09-03T08:18:18Z' },
        date_to: { type: 'string', example: '2024-09-03T08:18:18Z' },
        productIds: { type: 'string', example: '[1,2]' },
        banner_image: { type: 'string', format: 'binary' },
        promotionId: { type: 'string', example: 'r-pharm' },
      },
      required: ['profit', 'profitType', 'banner_color', 'date_from', 'date_to', 'productIds', 'promotionId'],
    },
  })
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor('banner_image'))
  @Post()
  createOffer(
    @Body() createOfferDto: CreateOfferDto,
    @UploadedFile() banner_image?: Express.Multer.File,
  ) {
    return this.createOfferService.create(createOfferDto, banner_image);
  }

  @ApiOperation({ summary: 'Получить предложение по ID', description: 'Возвращает данные предложения по идентификатору.' })
  @ApiResponse({ status: 200, description: 'Данные предложения', type: ResponseOfferDtoWithProducts })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Предложение не найдено' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @Get(':id')
  getOneOffer(@Param('id') id: number) {
    return this.getOneOfferService.getOne(id);
  }

  @ApiOperation({ summary: 'Получить все предложения', description: 'Возвращает список всех предложений.' })
  @ApiResponse({ status: 200, description: 'Список предложений', type: [ResponseOfferDto] })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @Get()
  getAllOffers() {
    return this.offersService.getAll();
  }

  @ApiOperation({ summary: 'Обновить предложение', description: 'Обновляет данные предложения.' })
  @ApiResponse({ status: 200, description: 'Предложение успешно обновлено', type: ResponseOfferDtoWithProducts })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Предложение не найдено' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @ApiBody({ type: UpdateOfferDto })
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor('banner_image'))
  @Patch(':id')
  updateOffer(
    @Param('id') id: number,
    @Body() updateOfferDto: UpdateOfferDto,
    @UploadedFile() banner_image?: Express.Multer.File,
  ) {
    return this.updateOfferService.update(id, updateOfferDto, banner_image);
  }

  @ApiOperation({ summary: 'Удалить предложение', description: 'Удаляет предложение по идентификатору.' })
  @ApiResponse({ status: 200, description: 'Предложение успешно удалено' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Предложение не найдено' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @UseGuards(AdminGuard)
  @Delete(':id')
  removeOffer(@Param('id') id: number) {
    return this.offersService.remove(id);
  }
}
