import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ApiBody, ApiResponse, ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdminGuard } from 'src/auth/guards/admin.guard';

@ApiBearerAuth()
@ApiTags('Product')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiOperation({ summary: 'Создать продукт', description: 'Создаёт новый продукт.' })
  @ApiResponse({ status: 201, description: 'Продукт успешно создан', type: UpdateProductDto })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 409, description: 'Продукт с такими параметрами уже существует' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @UseGuards(AdminGuard)
  @ApiBody({ type: CreateProductDto })
  @Post()
  createProduct(@Body() createProductsDto: CreateProductDto) {
    return this.productsService.create(createProductsDto);
  }

  @ApiOperation({ summary: 'Получить все продукты', description: 'Возвращает список всех продуктов.' })
  @ApiResponse({ status: 200, description: 'Список продуктов', type: [UpdateProductDto] })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @Get()
  getAllProducts() {
    return this.productsService.getAll();
  }

  @ApiOperation({ summary: 'Получить продукт по ID', description: 'Возвращает данные продукта по идентификатору.' })
  @ApiResponse({ status: 200, description: 'Данные продукта', type: UpdateProductDto })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Продукт не найден' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @Get(':id')
  getOneProduct(@Param('id') id: number) {
    return this.productsService.getOne(id);
  }

  @ApiOperation({ summary: 'Обновить продукт', description: 'Обновляет данные продукта.' })
  @ApiResponse({ status: 200, description: 'Продукт успешно обновлён', type: UpdateProductDto })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Продукт не найден' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @UseGuards(AdminGuard)
  @ApiBody({ type: UpdateProductDto })
  @Patch(':id')
  updateProduct(@Param('id') id: number, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @ApiOperation({ summary: 'Удалить продукт', description: 'Удаляет продукт по идентификатору.' })
  @ApiResponse({ status: 200, description: 'Продукт успешно удалён' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Продукт не найден' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @UseGuards(AdminGuard)
  @Delete(':id')
  removeProduct(@Param('id') id: number) {
    return this.productsService.remove(id);
  }
}
