import { Controller, Get, Post, Body, Param, Delete, Put } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';
import { ApiOperation, ApiResponse, ApiBody, ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth()
@ApiTags('Receipts')
@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @ApiOperation({ summary: 'Создать чек', description: 'Создаёт новый чек.' })
  @ApiResponse({ status: 201, description: 'Чек успешно создан' })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 409, description: 'Чек с такими параметрами уже существует' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @ApiBody({ type: CreateReceiptDto })
  @Post()
  create(@Body() createReceiptDto: CreateReceiptDto) {
    return this.receiptsService.create(createReceiptDto);
  }

  @ApiOperation({ summary: 'Получить все чеки', description: 'Возвращает список всех чеков.' })
  @ApiResponse({ status: 200, description: 'Список чеков' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @Get()
  findAll() {
    return this.receiptsService.getAll();
  }

  @ApiOperation({ summary: 'Получить чек по ID', description: 'Возвращает данные чека по идентификатору.' })
  @ApiResponse({ status: 200, description: 'Данные чека' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Чек не найден' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.receiptsService.getOne(+id);
  }

  @ApiOperation({ summary: 'Обновить чек', description: 'Обновляет данные чека.' })
  @ApiResponse({ status: 200, description: 'Чек успешно обновлён' })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Чек не найден' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @ApiBody({ type: UpdateReceiptDto })
  @Put(':id')
  update(@Body() updateReceiptDto: UpdateReceiptDto) {
    return this.receiptsService.update(updateReceiptDto);
  }

  @ApiOperation({ summary: 'Удалить чек', description: 'Удаляет чек по идентификатору.' })
  @ApiResponse({ status: 200, description: 'Чек успешно удалён' })
  @ApiResponse({ status: 401, description: 'Неавторизован' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён' })
  @ApiResponse({ status: 404, description: 'Чек не найден' })
  @ApiResponse({ status: 500, description: 'Внутренняя ошибка сервера' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.receiptsService.remove(+id);
  }
}
