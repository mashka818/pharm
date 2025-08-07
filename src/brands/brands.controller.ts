import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { BrandsService } from './brands.service';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { CreateBrandDto } from './dto/create-brand.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { ApiBody, ApiResponse, ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth()
@UseGuards(AdminGuard)
@ApiTags('Brand')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @ApiOperation({ summary: 'Создать бренд', description: 'Создаёт новый бренд в системе.' })
  @ApiResponse({ status: 201, description: 'Бренд успешно создан', type: UpdateBrandDto })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 409, description: 'Бренд с таким названием уже существует' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @ApiBody({ type: CreateBrandDto })
  @Post()
  @UseInterceptors(FileInterceptor('logo'))
  createBrand(@Body() createBrandDto: CreateBrandDto, @UploadedFile() logo: Express.Multer.File) {
    return this.brandsService.create(createBrandDto, logo);
  }

  @ApiOperation({ summary: 'Получить все бренды', description: 'Возвращает список всех брендов.' })
  @ApiResponse({ status: 200, description: 'Список брендов', type: [UpdateBrandDto] })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @Get()
  getAllBrands() {
    return this.brandsService.getAll();
  }

  @ApiOperation({ summary: 'Получить бренд по ID', description: 'Возвращает данные бренда по его идентификатору.' })
  @ApiResponse({ status: 200, description: 'Данные бренда', type: UpdateBrandDto })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Бренд не найден' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @Get(':id')
  getOneBrand(@Param('id') id: number) {
    return this.brandsService.getOne(id);
  }

  @ApiOperation({ summary: 'Обновить бренд', description: 'Обновляет данные бренда.' })
  @ApiResponse({ status: 200, description: 'Бренд успешно обновлён', type: UpdateBrandDto })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Бренд не найден' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @ApiBody({ type: UpdateBrandDto })
  @Patch(':id')
  @UseInterceptors(FileInterceptor('logo'))
  updateBrand(
    @Param('id') id: number,
    @Body() updateBrandDto: UpdateBrandDto,
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    return this.brandsService.update(id, updateBrandDto, logo);
  }

  @ApiOperation({ summary: 'Удалить бренд', description: 'Удаляет бренд по идентификатору.' })
  @ApiResponse({ status: 200, description: 'Бренд успешно удалён' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Бренд не найден' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @Delete(':id')
  removeBrand(@Param('id') id: number) {
    return this.brandsService.remove(id);
  }
}
